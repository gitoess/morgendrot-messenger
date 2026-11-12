/**
 * H.23 B2 P0: NFT-Schlüsselkarte — Slots at rest vault-verschlüsselt.
 * Spec: docs/NFT-SCHLUESSELKARTE-B2.md
 */

import {
  hasVaultEncSidecar,
  readVaultEncSidecar,
  removeVaultEncSidecar,
  writeVaultEncSidecar,
} from '@/frontend/lib/vault-enc-sidecar'
import {
  getVaultPasswordSession,
  hasVaultPasswordSession,
} from '@/frontend/lib/vault-password-session'

export const NFT_KEYCARD_ENC_LS_KEY = 'morgendrot.nftKeycard.enc.v1'
export const NFT_KEYCARD_ENC_SCHEMA = 'morgendrot.nft-keycard.enc.v1'
export const NFT_KEYCARD_VAULT_CHANGED_EVENT = 'morgendrot:nft-keycard-vault'
const SS_TAB = 'morgendrot.nftKeycard.tab.v1'
const PERSIST_DEBOUNCE_MS = 400
const MAX_CARDS = 40
const MAX_SLOTS = 8

export type NftKeycardSlot = {
  id: string
  passphrase: string
  note?: string
}

/** TBA-ähnlich: Vault-Index an der Schlüsselkarte (lokal / Tresor). */
export type NftKeycardBoundVault = {
  kind: 'bearer' | 'guarded'
  vaultObjectId: string
  messagingPackageId?: string
  createDigest?: string
}

export type NftKeycardEntry = {
  label?: string
  slots: NftKeycardSlot[]
  /** Wire-Fingerprint → Slot-ID */
  boundWires?: Record<string, string>
  /** Gebundene ImageNFT-/Objekt-IDs → Slot-ID (P2 Mint an Slot) */
  boundObjects?: Record<string, string>
  /** Gesichertes Guthaben an dieser Karte (Empfänger braucht das bei NFT-Transfer). */
  boundVault?: NftKeycardBoundVault
}

/** Slot-IDs: default, img, pwmsg, … */
export function normalizeNftKeycardSlotId(raw: string | undefined | null): string {
  const t = (raw || 'default').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24)
  return t || 'default'
}

type StorePlainV1 = {
  v: 1
  cards: Record<string, NftKeycardEntry>
}

let memoryCards: Record<string, NftKeycardEntry> = {}
let persistTimer: ReturnType<typeof setTimeout> | null = null

function normOid(objectId: string): string {
  return objectId.trim().toLowerCase()
}

/** 0x + Hex, fehlende führende Nullen auf 64 auffüllen (Explorer-Paste). */
export function normalizeNftObjectIdInput(raw: string): string {
  let t = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!t) return ''
  if (!t.startsWith('0x')) t = `0x${t}`
  const hex = t.slice(2)
  if (!/^[a-f0-9]+$/.test(hex) || hex.length === 0 || hex.length > 64) return t
  return `0x${hex.padStart(64, '0')}`
}

function emitChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(NFT_KEYCARD_VAULT_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

function trimCards(cards: Record<string, NftKeycardEntry>): Record<string, NftKeycardEntry> {
  const keys = Object.keys(cards)
  if (keys.length <= MAX_CARDS) return cards
  const out = { ...cards }
  for (const k of keys.slice(0, keys.length - MAX_CARDS)) delete out[k]
  return out
}

function writeTabBackup(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SS_TAB, JSON.stringify({ v: 1, cards: memoryCards } satisfies StorePlainV1))
  } catch {
    /* ignore */
  }
}

function readTabBackup(): StorePlainV1 | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SS_TAB)?.trim()
    if (!raw) return null
    return JSON.parse(raw) as StorePlainV1
  } catch {
    return null
  }
}

function clearTabBackup(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(SS_TAB)
  } catch {
    /* ignore */
  }
}

async function persistEncryptedNow(): Promise<void> {
  const pw = getVaultPasswordSession()
  if (!pw || typeof window === 'undefined') {
    writeTabBackup()
    return
  }
  memoryCards = trimCards(memoryCards)
  const plain: StorePlainV1 = { v: 1, cards: { ...memoryCards } }
  await writeVaultEncSidecar(NFT_KEYCARD_ENC_LS_KEY, NFT_KEYCARD_ENC_SCHEMA, JSON.stringify(plain), pw)
  clearTabBackup()
}

function schedulePersist(): void {
  writeTabBackup()
  if (!hasVaultPasswordSession()) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void persistEncryptedNow().catch(() => undefined)
  }, PERSIST_DEBOUNCE_MS)
}

function mergeCards(into: Record<string, NftKeycardEntry>, from: Record<string, NftKeycardEntry> | undefined): void {
  if (!from) return
  for (const [oid, entry] of Object.entries(from)) {
    const id = normOid(oid)
    if (!id.startsWith('0x') || id.length < 10) continue
    if (!into[id]) into[id] = { slots: [], ...(entry.label ? { label: entry.label } : {}) }
    const dest = into[id]!
    if (entry.label && !dest.label) dest.label = entry.label
    for (const slot of entry.slots || []) {
      if (!slot?.id || typeof slot.passphrase !== 'string' || slot.passphrase.trim().length < 8) continue
      const existing = dest.slots.find((s) => s.id === slot.id)
      if (existing) {
        existing.passphrase = slot.passphrase.trim()
        if (slot.note) existing.note = slot.note
      } else if (dest.slots.length < MAX_SLOTS) {
        dest.slots.push({
          id: slot.id.trim(),
          passphrase: slot.passphrase.trim(),
          ...(slot.note ? { note: slot.note } : {}),
        })
      }
    }
    if (entry.boundWires) {
      dest.boundWires = { ...(dest.boundWires || {}), ...entry.boundWires }
    }
    if (entry.boundObjects) {
      dest.boundObjects = { ...(dest.boundObjects || {}), ...entry.boundObjects }
    }
  }
}

export function hasEncryptedNftKeycardVault(): boolean {
  return hasVaultEncSidecar(NFT_KEYCARD_ENC_LS_KEY)
}

export async function unlockNftKeycardVault(password?: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const pw = (password ?? getVaultPasswordSession() ?? '').trim()
  if (pw.length < 8) return { ok: false, error: 'Vault-Passwort mindestens 8 Zeichen.' }

  memoryCards = {}
  const enc = await readVaultEncSidecar(NFT_KEYCARD_ENC_LS_KEY, NFT_KEYCARD_ENC_SCHEMA, pw)
  if (enc.ok) {
    try {
      const j = JSON.parse(enc.plainUtf8) as Partial<StorePlainV1>
      if (j?.cards && typeof j.cards === 'object') mergeCards(memoryCards, j.cards as Record<string, NftKeycardEntry>)
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  } else if (!enc.missing) {
    return { ok: false, error: enc.error }
  }

  const tab = readTabBackup()
  if (tab?.cards) mergeCards(memoryCards, tab.cards)

  if (Object.keys(memoryCards).length > 0) await persistEncryptedNow()
  emitChanged()
  return { ok: true }
}

export function lockNftKeycardVault(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  memoryCards = {}
  clearTabBackup()
  emitChanged()
}

export function purgeNftKeycardVault(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  memoryCards = {}
  removeVaultEncSidecar(NFT_KEYCARD_ENC_LS_KEY)
  clearTabBackup()
  emitChanged()
}

export function listNftKeycards(): { objectId: string; entry: NftKeycardEntry }[] {
  return Object.entries(memoryCards).map(([objectId, entry]) => ({ objectId, entry }))
}

export function getNftKeycard(objectId: string): NftKeycardEntry | null {
  return memoryCards[normOid(objectId)] ?? null
}

export function upsertNftKeycardSlot(opts: {
  objectId: string
  label?: string
  slotId?: string
  passphrase: string
  note?: string
}): { ok: true } | { ok: false; error: string } {
  if (!hasVaultPasswordSession()) {
    return {
      ok: false,
      error: 'Tresor entsperren — Schlüsselkarte wird nur im Vault gespeichert.',
    }
  }
  const oid = normOid(opts.objectId)
  if (!/^0x[a-f0-9]{64}$/.test(oid)) return { ok: false, error: 'Ungültige Object-ID.' }
  const pass = opts.passphrase.trim()
  if (pass.length < 8) return { ok: false, error: 'Passphrase mindestens 8 Zeichen.' }
  const slotId = normalizeNftKeycardSlotId(opts.slotId)
  const prev = memoryCards[oid] || { slots: [] }
  const slots = [...prev.slots]
  const idx = slots.findIndex((s) => s.id === slotId)
  const nextSlot: NftKeycardSlot = {
    id: slotId,
    passphrase: pass,
    ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
  }
  if (idx >= 0) slots[idx] = nextSlot
  else {
    if (slots.length >= MAX_SLOTS) return { ok: false, error: `Maximal ${MAX_SLOTS} Slots pro Karte.` }
    slots.push(nextSlot)
  }
  memoryCards = trimCards({
    ...memoryCards,
    [oid]: {
      slots,
      ...(opts.label?.trim() || prev.label ? { label: (opts.label?.trim() || prev.label)! } : {}),
      ...(prev.boundWires ? { boundWires: prev.boundWires } : {}),
      ...(prev.boundObjects ? { boundObjects: prev.boundObjects } : {}),
      ...(prev.boundVault ? { boundVault: prev.boundVault } : {}),
    },
  })
  schedulePersist()
  emitChanged()
  return { ok: true }
}

/** Bindet Purse/Treasury an die Schlüsselkarte (für Transfer/Empfänger-Gerät). */
export function bindVaultToNftKeycard(opts: {
  objectId: string
  vault: NftKeycardBoundVault
}): { ok: true } | { ok: false; error: string } {
  const oid = normOid(opts.objectId)
  const card = memoryCards[oid]
  if (!card) {
    return {
      ok: false,
      error: 'Keine Schlüsselkarte — zuerst „Als Schlüsselkarte merken“, dann Vault gebunden.',
    }
  }
  const vaultObjectId = normOid(opts.vault.vaultObjectId)
  if (!/^0x[a-f0-9]{64}$/.test(vaultObjectId)) return { ok: false, error: 'Ungültige Vault-Object-ID.' }
  memoryCards[oid] = {
    ...card,
    boundVault: {
      kind: opts.vault.kind,
      vaultObjectId,
      ...(opts.vault.messagingPackageId?.trim()
        ? { messagingPackageId: opts.vault.messagingPackageId.trim().toLowerCase() }
        : {}),
      ...(opts.vault.createDigest?.trim() ? { createDigest: opts.vault.createDigest.trim() } : {}),
    },
  }
  schedulePersist()
  emitChanged()
  return { ok: true }
}

/** Nach destroy_empty: boundVault entfernen, wenn es auf dieses Vault zeigt. */
export function clearBoundVaultFromNftKeycardIfMatches(opts: {
  objectId: string
  vaultObjectId: string
}): void {
  const oid = normOid(opts.objectId)
  const vid = normOid(opts.vaultObjectId)
  const card = memoryCards[oid]
  if (!card?.boundVault) return
  if (normOid(card.boundVault.vaultObjectId) !== vid) return
  const { boundVault: _drop, ...rest } = card
  memoryCards[oid] = rest
  schedulePersist()
  emitChanged()
}

export function removeNftKeycardSlot(opts: {
  objectId: string
  slotId: string
}): { ok: true } | { ok: false; error: string } {
  const oid = normOid(opts.objectId)
  const card = memoryCards[oid]
  if (!card) return { ok: false, error: 'Keine Schlüsselkarte für diese Object-ID.' }
  const slotId = normalizeNftKeycardSlotId(opts.slotId)
  if (card.slots.length <= 1) return { ok: false, error: 'Mindestens ein Slot muss bleiben.' }
  if (!card.slots.some((s) => s.id === slotId)) return { ok: false, error: 'Slot fehlt.' }
  const slots = card.slots.filter((s) => s.id !== slotId)
  const scrub = (m?: Record<string, string>) => {
    if (!m) return undefined
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(m)) {
      if (v !== slotId) next[k] = v
    }
    return Object.keys(next).length ? next : undefined
  }
  memoryCards[oid] = {
    ...card,
    slots,
    boundWires: scrub(card.boundWires),
    boundObjects: scrub(card.boundObjects),
  }
  schedulePersist()
  emitChanged()
  return { ok: true }
}

export function bindWireToNftKeycard(opts: {
  objectId: string
  wireFingerprint: string
  slotId?: string
}): { ok: true } | { ok: false; error: string } {
  const oid = normOid(opts.objectId)
  const card = memoryCards[oid]
  if (!card) return { ok: false, error: 'Keine Schlüsselkarte für diese Object-ID.' }
  const slotId = normalizeNftKeycardSlotId(opts.slotId)
  if (!card.slots.some((s) => s.id === slotId)) return { ok: false, error: 'Slot fehlt auf der Karte.' }
  const fp = opts.wireFingerprint.trim()
  if (!fp) return { ok: false, error: 'Wire-Fingerprint fehlt.' }
  memoryCards[oid] = {
    ...card,
    boundWires: { ...(card.boundWires || {}), [fp]: slotId },
  }
  schedulePersist()
  emitChanged()
  return { ok: true }
}

/** Bindet ein ImageNFT (oder anderes Objekt) an einen Slot der Schlüsselkarte. */
export function bindObjectToNftKeycard(opts: {
  cardObjectId: string
  boundObjectId: string
  slotId?: string
}): { ok: true } | { ok: false; error: string } {
  const cardOid = normalizeNftObjectIdInput(opts.cardObjectId)
  const boundOid = normalizeNftObjectIdInput(opts.boundObjectId)
  const card = memoryCards[cardOid] || memoryCards[normOid(opts.cardObjectId)]
  if (!card) return { ok: false, error: 'Keine Schlüsselkarte für diese Object-ID.' }
  if (!/^0x[a-f0-9]{64}$/.test(boundOid)) {
    return {
      ok: false,
      error: 'Ungültige gebundene Object-ID (erwartet 0x + 64 Hex, ggf. aus Galerie wählen).',
    }
  }
  const slotId = normalizeNftKeycardSlotId(opts.slotId)
  const slotOk =
    card.slots.some((s) => s.id === slotId) ||
    card.slots.some((s) => s.id === 'default') ||
    card.slots.length > 0
  if (!slotOk) return { ok: false, error: 'Slot fehlt auf der Karte.' }
  const resolvedSlot = card.slots.some((s) => s.id === slotId)
    ? slotId
    : card.slots.some((s) => s.id === 'default')
      ? 'default'
      : card.slots[0]!.id
  const storeOid = memoryCards[cardOid] ? cardOid : normOid(opts.cardObjectId)
  memoryCards[storeOid] = {
    ...card,
    boundObjects: { ...(card.boundObjects || {}), [boundOid]: resolvedSlot },
  }
  schedulePersist()
  emitChanged()
  return { ok: true }
}

/** Einzelne Wire-Bindung lösen (Fingerprint bleibt on-chain Ciphertext). */
export function unbindWireFromNftKeycard(opts: {
  objectId: string
  wireFingerprint: string
}): { ok: true } | { ok: false; error: string } {
  const oid = normOid(opts.objectId)
  const card = memoryCards[oid]
  if (!card) return { ok: false, error: 'Keine Schlüsselkarte für diese Object-ID.' }
  const fp = opts.wireFingerprint.trim()
  if (!fp || !card.boundWires?.[fp]) return { ok: false, error: 'Keine Wire-Bindung für diesen Fingerprint.' }
  const next = { ...(card.boundWires || {}) }
  delete next[fp]
  memoryCards[oid] = {
    ...card,
    boundWires: Object.keys(next).length ? next : undefined,
  }
  schedulePersist()
  emitChanged()
  return { ok: true }
}

/** Einzelne Objekt-Bindung (z. B. Enc-ImageNFT) von der Karte lösen. */
export function unbindObjectFromNftKeycard(opts: {
  cardObjectId: string
  boundObjectId: string
}): { ok: true } | { ok: false; error: string } {
  const cardOid = normOid(opts.cardObjectId)
  const boundOid = normOid(opts.boundObjectId)
  const card = memoryCards[cardOid]
  if (!card) return { ok: false, error: 'Keine Schlüsselkarte für diese Object-ID.' }
  if (!card.boundObjects?.[boundOid]) {
    return { ok: false, error: 'Keine Objekt-Bindung für diese ID.' }
  }
  const next = { ...(card.boundObjects || {}) }
  delete next[boundOid]
  memoryCards[cardOid] = {
    ...card,
    boundObjects: Object.keys(next).length ? next : undefined,
  }
  schedulePersist()
  emitChanged()
  return { ok: true }
}

/** Welche Karte+Slot ist an diesen Wire-Fingerprint gebunden? */
export function findNftKeycardBindingForWireFingerprint(wireFingerprint: string): {
  cardObjectId: string
  slotId: string
} | null {
  const fp = wireFingerprint.trim()
  if (!fp) return null
  for (const [objectId, entry] of Object.entries(memoryCards)) {
    const slotId = entry.boundWires?.[fp]
    if (slotId) return { cardObjectId: objectId, slotId }
  }
  return null
}

export function lookupPassphraseForNftKeycard(opts: {
  objectId?: string
  wireFingerprint?: string
  slotId?: string
}): string | null {
  if (opts.objectId?.trim()) {
    const oid = normOid(opts.objectId)
    const asCard = memoryCards[oid]
    if (asCard) {
      if (opts.wireFingerprint?.trim() && asCard.boundWires?.[opts.wireFingerprint.trim()]) {
        const sid = asCard.boundWires[opts.wireFingerprint.trim()]!
        return asCard.slots.find((s) => s.id === sid)?.passphrase ?? null
      }
      const sid = normalizeNftKeycardSlotId(opts.slotId)
      return asCard.slots.find((s) => s.id === sid)?.passphrase ?? asCard.slots[0]?.passphrase ?? null
    }
    for (const card of Object.values(memoryCards)) {
      const sid = card.boundObjects?.[oid]
      if (!sid) continue
      const pass = card.slots.find((s) => s.id === sid)?.passphrase
      if (pass) return pass
    }
  }
  if (opts.wireFingerprint?.trim()) {
    const fp = opts.wireFingerprint.trim()
    for (const card of Object.values(memoryCards)) {
      const sid = card.boundWires?.[fp]
      if (!sid) continue
      const pass = card.slots.find((s) => s.id === sid)?.passphrase
      if (pass) return pass
    }
  }
  return null
}

export function forgetNftKeycard(objectId: string): void {
  const next = { ...memoryCards }
  delete next[normOid(objectId)]
  memoryCards = next
  schedulePersist()
  emitChanged()
}

export async function flushNftKeycardVaultPersist(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await persistEncryptedNow()
}
