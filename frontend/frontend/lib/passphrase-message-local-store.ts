/**
 * Passphrase-Nachrichten-Keys: im entsperrten Zustand nur im RAM;
 * at rest AES-GCM mit Vault-Passwort (wie Session-Signer), nicht Klartext-localStorage.
 *
 * Lock → RAM leeren, Ciphertext behalten.
 * Purge → RAM + Ciphertext + Legacy-Klartext weg.
 */

import { normalizeMessengerWireContent } from '@/frontend/lib/compact-image-wire'
import {
  decryptHandoffEnvUtf8,
  encryptHandoffEnvUtf8,
  type HandoffCryptoMetaJson,
} from '@/frontend/lib/handoff-zip-crypto'
import { getVaultPasswordSession, setVaultPasswordSession } from '@/frontend/lib/vault-password-session'

const LS_KEY_LEGACY = 'morgendrot.passphraseMsg.v1'
const LS_DEFAULT_LEGACY = 'morgendrot.passphraseMsg.default.v1'
/** Vault-Passwort-verschlüsselter Sidecar (nicht die API-Vault-Datei). */
export const PASSPHRASE_MESSAGE_ENC_LS_KEY = 'morgendrot.passphraseMsg.enc.v1'
export const PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT = 'morgendrot:passphrase-msg-vault'
const SS_TAB = 'morgendrot.passphraseMsg.tab.v1'

const MAX_ENTRIES = 60
const PERSIST_DEBOUNCE_MS = 400

type Store = Record<string, string>

type EncPayloadV1 = {
  schema: 'morgendrot.passphrase-msg.enc.v1'
  crypto: HandoffCryptoMetaJson
  ciphertextB64: string
}

type EncPlainV1 = {
  v: 1
  byWire: Store
  defaultPass?: string
}

let memoryByWire: Store = {}
let memoryDefault: string | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
let persistInFlight: Promise<void> | null = null

export const PASSPHRASE_MESSAGE_LS_KEY = LS_KEY_LEGACY
export const PASSPHRASE_MESSAGE_DEFAULT_LS_KEY = LS_DEFAULT_LEGACY
export const PASSPHRASE_PROTECT_LS_KEY = 'morgendrot.composer.passphraseProtect'
export const PASSPHRASE_REUSE_LS_KEY = 'morgendrot.composer.passphraseReuse'
/** Absender: Passphrase nach Send auf diesem Gerät im Vault merken (Default an). */
export const PASSPHRASE_REMEMBER_ON_DEVICE_LS_KEY = 'morgendrot.composer.passphraseRememberOnDevice'
/** Optional: Object-ID einer NFT-Schlüsselkarte für PWMSG-Bindung (H.23 B2). */
export const PASSPHRASE_NFT_KEYCARD_BIND_LS_KEY = 'morgendrot.composer.nftKeycardBind.v1'
/** Optional: Slot-ID auf der gebundenen Schlüsselkarte (P2). */
export const PASSPHRASE_NFT_KEYCARD_BIND_SLOT_LS_KEY = 'morgendrot.composer.nftKeycardBindSlot.v1'
/**
 * B2-P4a: Starkes NFT-Besitz-Gate beim Senden (DEK-Capsule, kein Blank-DEK-Merken).
 * Braucht Schlüsselkarten-Bindung. App-enforced Owner-Check — kein Seal.
 */
export const PASSPHRASE_NFT_STRONG_GATE_LS_KEY = 'morgendrot.composer.nftStrongGate.v1'
/** P4a-dual: zusätzlich festgelegte Wallet (AND mit NFT-Leserecht). */
export const PASSPHRASE_NFT_DUAL_WALLET_GATE_LS_KEY = 'morgendrot.composer.nftDualWalletGate.v1'
export const PASSPHRASE_NFT_REQUIRED_WALLET_LS_KEY = 'morgendrot.composer.nftRequiredWallet.v1'
/** P4a2: Dual + ECDH-Pubkey-Wrap der DEK an Peer-Pub der requiredWallet. */
export const PASSPHRASE_NFT_PUBKEY_WRAP_P4A2_LS_KEY = 'morgendrot.composer.nftPubkeyWrapP4a2.v1'

/** FNV-1a über normalisierten Wire — Send und Inbox treffen denselben Fingerprint. */
export function fingerprintPassphraseMessageWire(wire: string): string {
  const t = normalizeMessengerWireContent(wire)
  let h = 2166136261
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `fnv:${t.length}:${(h >>> 0).toString(16)}`
}

function emitChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

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

function trimStore(s: Store): Store {
  const keys = Object.keys(s)
  if (keys.length <= MAX_ENTRIES) return s
  const out: Store = { ...s }
  for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete out[k]
  return out
}

function readLegacyPlainStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_KEY_LEGACY)
    if (!raw) return {}
    const j = JSON.parse(raw) as Record<string, unknown>
    const out: Store = {}
    for (const [k, v] of Object.entries(j || {})) {
      if (typeof v === 'string' && v.trim().length >= 8) out[k] = v.trim()
    }
    return out
  } catch {
    return {}
  }
}

function readLegacyDefault(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(LS_DEFAULT_LEGACY)?.trim() ?? ''
    return v.length >= 8 ? v : null
  } catch {
    return null
  }
}

function clearLegacyPlainStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_KEY_LEGACY)
    window.localStorage.removeItem(LS_DEFAULT_LEGACY)
  } catch {
    /* ignore */
  }
}

function readEncBlobRaw(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(PASSPHRASE_MESSAGE_ENC_LS_KEY)
  } catch {
    return null
  }
}

function writeEncBlobRaw(json: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PASSPHRASE_MESSAGE_ENC_LS_KEY, json)
  } catch {
    /* ignore */
  }
}

function removeEncBlob(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PASSPHRASE_MESSAGE_ENC_LS_KEY)
  } catch {
    /* ignore */
  }
}

export function hasEncryptedPassphraseMessageVault(): boolean {
  return !!readEncBlobRaw()?.trim()
}

export function isPassphraseMessageVaultSessionOpen(): boolean {
  return getVaultPasswordSession() != null
}

function mergeLegacyIntoMemory(): boolean {
  const legacy = readLegacyPlainStore()
  const legDef = readLegacyDefault()
  let changed = false
  for (const [k, v] of Object.entries(legacy)) {
    if (!memoryByWire[k]) {
      memoryByWire[k] = v
      changed = true
    }
  }
  if (!memoryDefault && legDef) {
    memoryDefault = legDef
    changed = true
  }
  return changed
}

function writeTabBackup(): void {
  if (typeof window === 'undefined') return
  try {
    const plain: EncPlainV1 = {
      v: 1,
      byWire: { ...memoryByWire },
      ...(memoryDefault ? { defaultPass: memoryDefault } : {}),
    }
    window.sessionStorage.setItem(SS_TAB, JSON.stringify(plain))
  } catch {
    /* ignore */
  }
}

function readTabBackup(): EncPlainV1 | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SS_TAB)?.trim()
    if (!raw) return null
    return JSON.parse(raw) as EncPlainV1
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
  if (!pw || pw.length < 8 || typeof window === 'undefined') {
    writeTabBackup()
    return
  }
  memoryByWire = trimStore(memoryByWire)
  const plain: EncPlainV1 = {
    v: 1,
    byWire: { ...memoryByWire },
    ...(memoryDefault ? { defaultPass: memoryDefault } : {}),
  }
  const { meta, ciphertext } = await encryptHandoffEnvUtf8(JSON.stringify(plain), pw)
  const payload: EncPayloadV1 = {
    schema: 'morgendrot.passphrase-msg.enc.v1',
    crypto: meta,
    ciphertextB64: bytesToB64(ciphertext),
  }
  writeEncBlobRaw(JSON.stringify(payload))
  clearLegacyPlainStorage()
  clearTabBackup()
}

function schedulePersist(): void {
  writeTabBackup()
  if (!isPassphraseMessageVaultSessionOpen()) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    persistInFlight = persistEncryptedNow().catch(() => undefined)
  }, PERSIST_DEBOUNCE_MS)
}

/**
 * Nach Vault-Unlock: Ciphertext laden + Legacy migrieren.
 * Ohne gültiges Passwort bleibt die Sitzung speicherlos (nur RAM bis Reload).
 */
export async function unlockPassphraseMessageVault(password: string): Promise<
  { ok: true; migratedLegacy: boolean } | { ok: false; error: string }
> {
  const pw = password.trim()
  if (pw.length < 8) {
    return { ok: false, error: 'Vault-Passwort mindestens 8 Zeichen für Chat-Passphrasen.' }
  }
  setVaultPasswordSession(pw)
  memoryByWire = {}
  memoryDefault = null

  const raw = readEncBlobRaw()?.trim()
  if (raw) {
    try {
      const payload = JSON.parse(raw) as Partial<EncPayloadV1>
      if (
        payload.schema !== 'morgendrot.passphrase-msg.enc.v1' ||
        !payload.crypto ||
        !payload.ciphertextB64
      ) {
        return { ok: false, error: 'Chat-Passphrasen-Vault hat unbekanntes Format.' }
      }
      const dec = await decryptHandoffEnvUtf8(payload.crypto, b64ToBytes(payload.ciphertextB64), pw)
      if (!dec.ok) {
        return { ok: false, error: dec.error }
      }
      const j = JSON.parse(dec.envText) as Partial<EncPlainV1>
      const byWire: Store = {}
      if (j?.byWire && typeof j.byWire === 'object') {
        for (const [k, v] of Object.entries(j.byWire)) {
          if (typeof v === 'string' && v.trim().length >= 8) byWire[k] = v.trim()
        }
      }
      memoryByWire = byWire
      const d = typeof j.defaultPass === 'string' ? j.defaultPass.trim() : ''
      memoryDefault = d.length >= 8 ? d : null
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  const migratedLegacy = mergeLegacyIntoMemory()
  const tab = readTabBackup()
  if (tab?.byWire) {
    for (const [k, v] of Object.entries(tab.byWire)) {
      if (typeof v === 'string' && v.trim().length >= 8 && !memoryByWire[k]) memoryByWire[k] = v.trim()
    }
  }
  if (!memoryDefault && tab?.defaultPass && tab.defaultPass.trim().length >= 8) {
    memoryDefault = tab.defaultPass.trim()
  }
  if (migratedLegacy || Object.keys(memoryByWire).length > 0 || memoryDefault || tab) {
    await persistEncryptedNow()
  }
  emitChanged()
  return { ok: true, migratedLegacy }
}

/** Sitzung sperren: Klartext aus RAM + Tab-Backup; Ciphertext-Sidecar bleibt. */
export function lockPassphraseMessageVault(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  memoryByWire = {}
  memoryDefault = null
  clearTabBackup()
  emitChanged()
}

/** Unwiderruflich: RAM + verschlüsselter Sidecar + Legacy-Klartext. */
export function purgePassphraseMessageVault(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  memoryByWire = {}
  memoryDefault = null
  removeEncBlob()
  clearLegacyPlainStorage()
  clearTabBackup()
  emitChanged()
}

/** @deprecated Alias — früher Klartext-Wipe; jetzt voller Purge. */
export function clearAllPassphraseMessagePassphrases(): void {
  purgePassphraseMessageVault()
}

export function rememberPassphraseMessagePassphrase(wire: string, passphrase: string): void {
  const pass = passphrase.trim()
  if (pass.length < 8 || !wire.trim()) return
  const fp = fingerprintPassphraseMessageWire(wire)
  if (memoryByWire[fp] === pass) {
    // Nach Enc-Flush fehlt oft das Tab-Backup — ohne Event nachziehen (kein UI-Flackern).
    try {
      if (typeof window !== 'undefined' && !window.sessionStorage.getItem(SS_TAB)) writeTabBackup()
    } catch {
      /* ignore */
    }
    return
  }
  memoryByWire = { ...memoryByWire, [fp]: pass }
  memoryByWire = trimStore(memoryByWire)
  schedulePersist()
  emitChanged()
}

/** Default true — Absender-Komfort; Opt-out im Composer. */
export function readPassphraseRememberOnDeviceEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = window.localStorage.getItem(PASSPHRASE_REMEMBER_ON_DEVICE_LS_KEY)
    if (v === null || v === '') return true
    return v !== '0'
  } catch {
    return true
  }
}

export function writePassphraseRememberOnDeviceEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PASSPHRASE_REMEMBER_ON_DEVICE_LS_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function lookupPassphraseMessagePassphrase(wire: string): string | null {
  return memoryByWire[fingerprintPassphraseMessageWire(wire)] ?? null
}

export function forgetPassphraseMessagePassphrase(wire: string): void {
  const next = { ...memoryByWire }
  delete next[fingerprintPassphraseMessageWire(wire)]
  memoryByWire = next
  schedulePersist()
  emitChanged()
}

export function getDefaultPassphraseMessagePassphrase(): string | null {
  return memoryDefault
}

export function setDefaultPassphraseMessagePassphrase(passphrase: string): void {
  const pass = passphrase.trim()
  if (pass.length < 8) return
  memoryDefault = pass
  schedulePersist()
  emitChanged()
}

export function clearDefaultPassphraseMessagePassphrase(): void {
  memoryDefault = null
  schedulePersist()
  emitChanged()
}

export function readPassphraseProtectEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(PASSPHRASE_PROTECT_LS_KEY) === '1'
  } catch {
    return false
  }
}

export function writePassphraseProtectEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PASSPHRASE_PROTECT_LS_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Default true — sonst geht die Passphrase nach jedem Send verloren (Neu würfeln). */
export function readPassphraseReuseEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = window.localStorage.getItem(PASSPHRASE_REUSE_LS_KEY)
    if (v === null || v === '') return true
    return v !== '0'
  } catch {
    return true
  }
}

export function writePassphraseReuseEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PASSPHRASE_REUSE_LS_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function readPassphraseNftKeycardBindObjectId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(PASSPHRASE_NFT_KEYCARD_BIND_LS_KEY)?.trim().toLowerCase()
    return v && /^0x[a-f0-9]{64}$/.test(v) ? v : null
  } catch {
    return null
  }
}

export function writePassphraseNftKeycardBindObjectId(objectId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!objectId?.trim()) {
      window.localStorage.removeItem(PASSPHRASE_NFT_KEYCARD_BIND_LS_KEY)
      window.localStorage.removeItem(PASSPHRASE_NFT_KEYCARD_BIND_SLOT_LS_KEY)
      window.localStorage.setItem(PASSPHRASE_NFT_STRONG_GATE_LS_KEY, '0')
      return
    }
    const v = objectId.trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(v)) return
    window.localStorage.setItem(PASSPHRASE_NFT_KEYCARD_BIND_LS_KEY, v)
  } catch {
    /* ignore */
  }
}

export function readPassphraseNftKeycardBindSlotId(): string {
  if (typeof window === 'undefined') return 'default'
  try {
    const v = window.localStorage.getItem(PASSPHRASE_NFT_KEYCARD_BIND_SLOT_LS_KEY)?.trim().toLowerCase()
    if (!v) return 'default'
    return v.replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'default'
  } catch {
    return 'default'
  }
}

export function writePassphraseNftKeycardBindSlotId(slotId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!slotId?.trim()) {
      window.localStorage.removeItem(PASSPHRASE_NFT_KEYCARD_BIND_SLOT_LS_KEY)
      return
    }
    const v = slotId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24)
    if (!v) {
      window.localStorage.removeItem(PASSPHRASE_NFT_KEYCARD_BIND_SLOT_LS_KEY)
      return
    }
    window.localStorage.setItem(PASSPHRASE_NFT_KEYCARD_BIND_SLOT_LS_KEY, v)
  } catch {
    /* ignore */
  }
}

export function readPassphraseNftStrongGateEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(PASSPHRASE_NFT_STRONG_GATE_LS_KEY) === '1'
  } catch {
    return false
  }
}

export function writePassphraseNftStrongGateEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PASSPHRASE_NFT_STRONG_GATE_LS_KEY, on ? '1' : '0')
    if (!on) {
      window.localStorage.setItem(PASSPHRASE_NFT_DUAL_WALLET_GATE_LS_KEY, '0')
    }
  } catch {
    /* ignore */
  }
}

export function readPassphraseNftDualWalletGateEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (
      readPassphraseNftStrongGateEnabled() &&
      window.localStorage.getItem(PASSPHRASE_NFT_DUAL_WALLET_GATE_LS_KEY) === '1'
    )
  } catch {
    return false
  }
}

export function writePassphraseNftDualWalletGateEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PASSPHRASE_NFT_DUAL_WALLET_GATE_LS_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function readPassphraseNftRequiredWallet(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(PASSPHRASE_NFT_REQUIRED_WALLET_LS_KEY)?.trim().toLowerCase()
    return v && /^0x[a-f0-9]{64}$/.test(v) ? v : null
  } catch {
    return null
  }
}

export function writePassphraseNftRequiredWallet(address: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!address?.trim()) {
      window.localStorage.removeItem(PASSPHRASE_NFT_REQUIRED_WALLET_LS_KEY)
      return
    }
    const v = address.trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(v)) return
    window.localStorage.setItem(PASSPHRASE_NFT_REQUIRED_WALLET_LS_KEY, v)
  } catch {
    /* ignore */
  }
}

export function readPassphraseNftPubkeyWrapP4a2Enabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (
      readPassphraseNftDualWalletGateEnabled() &&
      window.localStorage.getItem(PASSPHRASE_NFT_PUBKEY_WRAP_P4A2_LS_KEY) === '1'
    )
  } catch {
    return false
  }
}

export function writePassphraseNftPubkeyWrapP4a2Enabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PASSPHRASE_NFT_PUBKEY_WRAP_P4A2_LS_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/**
 * Passphrase für den nächsten Send.
 * Feld / Default gilt immer (auch ohne „Wiederverwenden“ — sonst wären Neu würfeln /
 * Kopieren wirkungslos). „Wiederverwenden“ entscheidet nur, ob der Default nach dem
 * Send stehen bleibt (reuse) oder für den nächsten Send neu gewürfelt wird.
 */
export function resolvePassphraseForProtectSend(generateFresh: () => string): {
  passphrase: string
  reused: boolean
} {
  const reuse = readPassphraseReuseEnabled()
  const existing = getDefaultPassphraseMessagePassphrase()
  if (existing) return { passphrase: existing, reused: reuse }
  if (!isPassphraseMessageVaultSessionOpen()) {
    return { passphrase: '', reused: reuse }
  }
  const fresh = generateFresh().trim()
  if (fresh.length >= 8) setDefaultPassphraseMessagePassphrase(fresh)
  return { passphrase: fresh, reused: reuse }
}

/** Nach Send ohne Wiederverwenden: neue Vorschau-Passphrase fürs nächste Mal. */
export function rollPassphraseAfterOneShotSend(generateFresh: () => string): string | null {
  if (readPassphraseReuseEnabled()) return getDefaultPassphraseMessagePassphrase()
  if (!isPassphraseMessageVaultSessionOpen()) {
    clearDefaultPassphraseMessagePassphrase()
    return null
  }
  const fresh = generateFresh().trim()
  if (fresh.length >= 8) setDefaultPassphraseMessagePassphrase(fresh)
  else clearDefaultPassphraseMessagePassphrase()
  return getDefaultPassphraseMessagePassphrase()
}

/** Tests / Debounce flush. */
export async function flushPassphraseMessageVaultPersist(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  if (persistInFlight) await persistInFlight
  await persistEncryptedNow()
}
