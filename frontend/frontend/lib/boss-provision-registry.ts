'use client'

/**
 * Boss-Registry: verschlüsselte Historie provisionierter Geräte (Custody B).
 * Klartext-Seed nur nach Master-Passwort — nie in der Registry-Thumbnails.
 */
import type { HandoffEinsatzPresetId } from '@/frontend/lib/handoff-export-presets'
import {
  decryptHandoffEnvUtf8,
  encryptHandoffEnvUtf8,
  type HandoffCryptoMetaJson,
} from '@/frontend/lib/handoff-zip-crypto'

export const BOSS_PROVISION_REGISTRY_SCHEMA = 'morgendrot.boss-provision-registry.v1' as const
const LS_BOSS_PROVISION_REGISTRY = 'morgendrot.bossProvisionRegistry.v1'

/** Feuert bei Entsperren, Sperren und jeder Änderung — z. B. für „Mein Team“-Panel. */
export const BOSS_PROVISION_REGISTRY_CHANGED_EVENT = 'morgendrot.bossProvisionRegistryChanged'

function notifyBossProvisionRegistryChanged(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  try {
    window.dispatchEvent(new CustomEvent(BOSS_PROVISION_REGISTRY_CHANGED_EVENT))
  } catch {
    // Event ist Best-Effort — Persistenz darf daran nie scheitern.
  }
}

export type BossProvisionRegistryEntry = {
  id: string
  label: string
  presetId: HandoffEinsatzPresetId
  address: string
  createdAtIso: string
  seedShownAtIso?: string
  handedOverAtIso?: string
  zipFilenameBase?: string
  /** Lokale Messenger-Gruppe (Mitgliederliste) — optional */
  messengerGroupId?: string
  seedEnc: {
    crypto: HandoffCryptoMetaJson
    ciphertextB64: string
  }
}

type BossProvisionRegistryPayload = {
  schema: typeof BOSS_PROVISION_REGISTRY_SCHEMA
  entries: BossProvisionRegistryEntry[]
}

type StoredBossProvisionRegistry = {
  schema: typeof BOSS_PROVISION_REGISTRY_SCHEMA
  crypto: HandoffCryptoMetaJson
  ciphertextB64: string
}

let unlockedEntries: BossProvisionRegistryEntry[] | null = null
let unlockedPassword: string | null = null

function bytesToB64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!)
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function readStoredRaw(): StoredBossProvisionRegistry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_BOSS_PROVISION_REGISTRY)?.trim()
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<StoredBossProvisionRegistry>
    if (j.schema !== BOSS_PROVISION_REGISTRY_SCHEMA || !j.crypto || !j.ciphertextB64) return null
    return j as StoredBossProvisionRegistry
  } catch {
    return null
  }
}

async function persistUnlocked(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'Kein Browser.' }
  if (!unlockedEntries) return { ok: false, error: 'Registry nicht entsperrt.' }
  try {
    const payload: BossProvisionRegistryPayload = {
      schema: BOSS_PROVISION_REGISTRY_SCHEMA,
      entries: unlockedEntries,
    }
    const { meta, ciphertext } = await encryptHandoffEnvUtf8(JSON.stringify(payload), password)
    const stored: StoredBossProvisionRegistry = {
      schema: BOSS_PROVISION_REGISTRY_SCHEMA,
      crypto: meta,
      ciphertextB64: bytesToB64(ciphertext),
    }
    window.localStorage.setItem(LS_BOSS_PROVISION_REGISTRY, JSON.stringify(stored))
    unlockedPassword = password
    notifyBossProvisionRegistryChanged()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'Registry speichern fehlgeschlagen.' }
  }
}

export function hasBossProvisionRegistry(): boolean {
  return readStoredRaw() != null
}

export function isBossProvisionRegistryUnlocked(): boolean {
  return unlockedEntries != null
}

export function lockBossProvisionRegistry(): void {
  unlockedEntries = null
  unlockedPassword = null
  notifyBossProvisionRegistryChanged()
}

export function getBossProvisionRegistryEntries(): BossProvisionRegistryEntry[] {
  return unlockedEntries ? [...unlockedEntries] : []
}

export async function unlockBossProvisionRegistry(
  password: string
): Promise<{ ok: true; entries: BossProvisionRegistryEntry[] } | { ok: false; error: string }> {
  const stored = readStoredRaw()
  if (!stored) {
    unlockedEntries = []
    unlockedPassword = password
    notifyBossProvisionRegistryChanged()
    return { ok: true, entries: [] }
  }
  const dec = await decryptHandoffEnvUtf8(stored.crypto, b64ToBytes(stored.ciphertextB64), password)
  if (!dec.ok) return { ok: false, error: dec.error }
  try {
    const payload = JSON.parse(dec.envText) as Partial<BossProvisionRegistryPayload>
    if (payload.schema !== BOSS_PROVISION_REGISTRY_SCHEMA || !Array.isArray(payload.entries)) {
      return { ok: false, error: 'Registry-Format unbekannt.' }
    }
    unlockedEntries = payload.entries
    unlockedPassword = password
    notifyBossProvisionRegistryChanged()
    return { ok: true, entries: [...unlockedEntries] }
  } catch {
    return { ok: false, error: 'Registry-Inhalt beschädigt.' }
  }
}

export async function initializeBossProvisionRegistry(
  password: string,
  confirm: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (hasBossProvisionRegistry()) return { ok: false, error: 'Registry existiert bereits — bitte entsperren.' }
  if (!password || password.length < 8) {
    return { ok: false, error: 'Master-Passwort: mindestens 8 Zeichen.' }
  }
  if (password !== confirm) return { ok: false, error: 'Passwort und Wiederholung stimmen nicht überein.' }
  unlockedEntries = []
  unlockedPassword = password
  return persistUnlocked(password)
}

async function encryptSeedImport(seedImport: string, password: string): Promise<BossProvisionRegistryEntry['seedEnc']> {
  const { meta, ciphertext } = await encryptHandoffEnvUtf8(
    JSON.stringify({ seedImport: seedImport.trim() }),
    password
  )
  return { crypto: meta, ciphertextB64: bytesToB64(ciphertext) }
}

export async function addBossProvisionRegistryEntry(opts: {
  label: string
  presetId: HandoffEinsatzPresetId
  address: string
  seedImport: string
  zipFilenameBase?: string
  masterPassword: string
  messengerGroupId?: string
}): Promise<{ ok: true; entry: BossProvisionRegistryEntry } | { ok: false; error: string }> {
  if (!unlockedEntries) return { ok: false, error: 'Registry ist gesperrt.' }
  const password = opts.masterPassword || unlockedPassword || ''
  if (!password) return { ok: false, error: 'Master-Passwort fehlt.' }
  try {
    const seedEnc = await encryptSeedImport(opts.seedImport, password)
    const entry: BossProvisionRegistryEntry = {
      id: crypto.randomUUID(),
      label: opts.label.trim() || 'Gerät',
      presetId: opts.presetId,
      address: opts.address.trim(),
      createdAtIso: new Date().toISOString(),
      zipFilenameBase: opts.zipFilenameBase,
      ...(opts.messengerGroupId?.trim() ? { messengerGroupId: opts.messengerGroupId.trim() } : {}),
      seedEnc,
    }
    unlockedEntries = [entry, ...unlockedEntries]
    const saved = await persistUnlocked(password)
    if (!saved.ok) return saved
    return { ok: true, entry }
  } catch (e) {
    return { ok: false, error: 'Registry speichern fehlgeschlagen.' }
  }
}

export type BossProvisionRegistryEntryPatch = Partial<
  Pick<BossProvisionRegistryEntry, 'seedShownAtIso' | 'handedOverAtIso'>
> & {
  /** `null` oder `''` entfernt die Gruppen-Zuordnung. */
  messengerGroupId?: string | null
}

export async function updateBossProvisionRegistryEntry(
  id: string,
  patch: BossProvisionRegistryEntryPatch
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!unlockedEntries) return { ok: false, error: 'Registry ist gesperrt.' }
  const idx = unlockedEntries.findIndex((e) => e.id === id)
  if (idx < 0) return { ok: false, error: 'Eintrag nicht gefunden.' }
  const current = unlockedEntries[idx]!
  const { messengerGroupId, ...rest } = patch
  const next: BossProvisionRegistryEntry = { ...current, ...rest }
  if (messengerGroupId === null || messengerGroupId === '') {
    delete next.messengerGroupId
  } else if (typeof messengerGroupId === 'string') {
    next.messengerGroupId = messengerGroupId
  }
  unlockedEntries[idx] = next
  const password = unlockedPassword || ''
  if (!password) return { ok: false, error: 'Master-Passwort fehlt.' }
  return persistUnlocked(password)
}

export async function revealBossProvisionSeed(
  entry: BossProvisionRegistryEntry,
  password: string
): Promise<{ ok: true; seedImport: string } | { ok: false; error: string }> {
  // Fallback auf das Passwort der entsperrten Session — z. B. wenn die Registry
  // in einem anderen Panel (Schnell-Assistent) entsperrt wurde.
  const effectivePassword = password || unlockedPassword || ''
  if (!effectivePassword) {
    return { ok: false, error: 'Registry ist gesperrt — Master-Passwort eingeben.' }
  }
  const dec = await decryptHandoffEnvUtf8(
    entry.seedEnc.crypto,
    b64ToBytes(entry.seedEnc.ciphertextB64),
    effectivePassword
  )
  if (!dec.ok) return { ok: false, error: dec.error }
  try {
    const j = JSON.parse(dec.envText) as { seedImport?: unknown }
    const seedImport = typeof j.seedImport === 'string' ? j.seedImport.trim() : ''
    if (!seedImport) return { ok: false, error: 'Seed-Eintrag leer.' }
    return { ok: true, seedImport }
  } catch {
    return { ok: false, error: 'Seed-Eintrag beschädigt.' }
  }
}

export type BossProvisionRegistryBackupFile = StoredBossProvisionRegistry & {
  exportedAtIso: string
}

/** Verschlüsselter Registry-Blob aus localStorage (ohne Klartext-Seeds). */
export function readBossProvisionRegistryBackupPayload(): BossProvisionRegistryBackupFile | null {
  const stored = readStoredRaw()
  if (!stored) return null
  return { ...stored, exportedAtIso: new Date().toISOString() }
}

export function downloadBossProvisionRegistryBackup(): { ok: true } | { ok: false; error: string } {
  if (typeof window === 'undefined') return { ok: false, error: 'Kein Browser.' }
  const payload = readBossProvisionRegistryBackupPayload()
  if (!payload) return { ok: false, error: 'Keine Registry zum Sichern — zuerst Gerät provisionieren.' }
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `morgendrot-boss-provision-registry-${new Date().toISOString().slice(0, 10)}.json`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'Registry speichern fehlgeschlagen.' }
  }
}

export function parseBossProvisionRegistryBackupFile(
  text: string
): { ok: true; payload: StoredBossProvisionRegistry } | { ok: false; error: string } {
  try {
    const j = JSON.parse(text) as Partial<BossProvisionRegistryBackupFile>
    if (j.schema !== BOSS_PROVISION_REGISTRY_SCHEMA || !j.crypto || !j.ciphertextB64) {
      return { ok: false, error: 'Keine gültige Boss-Registry-Sicherung.' }
    }
    return {
      ok: true,
      payload: { schema: j.schema, crypto: j.crypto, ciphertextB64: j.ciphertextB64 },
    }
  } catch {
    return { ok: false, error: 'JSON der Sicherung unlesbar.' }
  }
}

/** Ersetzt lokale Registry — Passwort muss zur Sicherung passen (Test-Entsperren). */
export async function importBossProvisionRegistryBackup(
  payload: StoredBossProvisionRegistry,
  password: string
): Promise<{ ok: true; entryCount: number } | { ok: false; error: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'Kein Browser.' }
  const dec = await decryptHandoffEnvUtf8(payload.crypto, b64ToBytes(payload.ciphertextB64), password)
  if (!dec.ok) return { ok: false, error: dec.error }
  try {
    const parsed = JSON.parse(dec.envText) as Partial<BossProvisionRegistryPayload>
    if (parsed.schema !== BOSS_PROVISION_REGISTRY_SCHEMA || !Array.isArray(parsed.entries)) {
      return { ok: false, error: 'Registry-Inhalt in der Sicherung ungültig.' }
    }
    window.localStorage.setItem(LS_BOSS_PROVISION_REGISTRY, JSON.stringify(payload))
    unlockedEntries = parsed.entries
    unlockedPassword = password
    return { ok: true, entryCount: parsed.entries.length }
  } catch {
    return { ok: false, error: 'Registry-Inhalt beschädigt.' }
  }
}

export function countBossProvisionRegistryByStatus(entries: BossProvisionRegistryEntry[]): {
  total: number
  open: number
  seedShown: number
  handedOver: number
} {
  let handedOver = 0
  let seedShown = 0
  for (const e of entries) {
    if (e.handedOverAtIso) handedOver++
    else if (e.seedShownAtIso) seedShown++
  }
  const total = entries.length
  const open = total - handedOver
  return { total, open, seedShown, handedOver }
}

/** Nur für Tests */
export function __resetBossProvisionRegistryForTests(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(LS_BOSS_PROVISION_REGISTRY)
    } catch {
      /* ignore */
    }
  }
  lockBossProvisionRegistry()
}
