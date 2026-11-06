/**
 * ImageNFT-Passphrasen: Klartext nur im RAM; at rest AES-GCM mit Vault-Passwort.
 * Lock → RAM leer; Purge/Einsatz-Ende → Sidecar weg.
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

const LS_KEY_LEGACY = 'morgendrot.evidenceImage.passphrases.v1'
const LS_DEFAULT_LEGACY = 'morgendrot.evidenceImage.defaultPassphrase.v1'
export const EVIDENCE_PASSPHRASE_ENC_LS_KEY = 'morgendrot.evidenceImage.passphrases.enc.v1'
export const EVIDENCE_PASSPHRASE_SCHEMA = 'morgendrot.evidence-pass.enc.v1'
export const EVIDENCE_PASSPHRASE_VAULT_CHANGED_EVENT = 'morgendrot:evidence-pass-vault'

const MAX_ENTRIES = 40
const PERSIST_DEBOUNCE_MS = 400
const SS_TAB = 'morgendrot.evidenceImage.passphrases.tab.v1'

type Store = Record<string, string>

type EncPlainV1 = {
  v: 1
  byId: Store
  defaultPass?: string
}

let memoryById: Store = {}
let memoryDefault: string | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null

export const EVIDENCE_PASSPHRASE_LS_KEY = LS_KEY_LEGACY
export const EVIDENCE_DEFAULT_PASSPHRASE_LS_KEY = LS_DEFAULT_LEGACY

function emitChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(EVIDENCE_PASSPHRASE_VAULT_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

function normKey(id: string): string {
  return id.trim().toLowerCase()
}

function trimStore(s: Store): Store {
  const keys = Object.keys(s)
  if (keys.length <= MAX_ENTRIES) return s
  const out: Store = { ...s }
  for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete out[k]
  return out
}

function readLegacyPlain(): { byId: Store; defaultPass: string | null } {
  const byId: Store = {}
  let defaultPass: string | null = null
  if (typeof window === 'undefined') return { byId, defaultPass }
  try {
    const raw = window.localStorage.getItem(LS_KEY_LEGACY)
    if (raw) {
      const j = JSON.parse(raw) as Record<string, unknown>
      for (const [k, v] of Object.entries(j || {})) {
        if (typeof v === 'string' && v.trim().length >= 8) byId[normKey(k)] = v.trim()
      }
    }
    const d = window.localStorage.getItem(LS_DEFAULT_LEGACY)?.trim() ?? ''
    if (d.length >= 8) defaultPass = d
  } catch {
    /* ignore */
  }
  return { byId, defaultPass }
}

function clearLegacyPlain(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_KEY_LEGACY)
    window.localStorage.removeItem(LS_DEFAULT_LEGACY)
  } catch {
    /* ignore */
  }
}

function writeTabBackup(): void {
  if (typeof window === 'undefined') return
  try {
    const plain: EncPlainV1 = {
      v: 1,
      byId: { ...memoryById },
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

function mergeStore(into: Store, from: Store): boolean {
  let changed = false
  for (const [k, v] of Object.entries(from)) {
    if (!into[k] && v.trim().length >= 8) {
      into[k] = v.trim()
      changed = true
    }
  }
  return changed
}

async function persistEncryptedNow(): Promise<void> {
  const pw = getVaultPasswordSession()
  if (!pw || typeof window === 'undefined') {
    writeTabBackup()
    return
  }
  memoryById = trimStore(memoryById)
  const plain: EncPlainV1 = {
    v: 1,
    byId: { ...memoryById },
    ...(memoryDefault ? { defaultPass: memoryDefault } : {}),
  }
  await writeVaultEncSidecar(EVIDENCE_PASSPHRASE_ENC_LS_KEY, EVIDENCE_PASSPHRASE_SCHEMA, JSON.stringify(plain), pw)
  clearLegacyPlain()
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

export async function unlockEvidencePassphraseVault(password?: string): Promise<
  { ok: true; migratedLegacy: boolean } | { ok: false; error: string }
> {
  const pw = (password ?? getVaultPasswordSession() ?? '').trim()
  if (pw.length < 8) return { ok: false, error: 'Vault-Passwort mindestens 8 Zeichen.' }

  memoryById = {}
  memoryDefault = null

  const enc = await readVaultEncSidecar(EVIDENCE_PASSPHRASE_ENC_LS_KEY, EVIDENCE_PASSPHRASE_SCHEMA, pw)
  if (enc.ok) {
    try {
      const j = JSON.parse(enc.plainUtf8) as Partial<EncPlainV1>
      if (j?.byId && typeof j.byId === 'object') {
        for (const [k, v] of Object.entries(j.byId)) {
          if (typeof v === 'string' && v.trim().length >= 8) memoryById[normKey(k)] = v.trim()
        }
      }
      const d = typeof j.defaultPass === 'string' ? j.defaultPass.trim() : ''
      memoryDefault = d.length >= 8 ? d : null
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  } else if (!enc.missing) {
    return { ok: false, error: enc.error }
  }

  const legacy = readLegacyPlain()
  let migratedLegacy = mergeStore(memoryById, legacy.byId)
  if (!memoryDefault && legacy.defaultPass) {
    memoryDefault = legacy.defaultPass
    migratedLegacy = true
  }

  const tab = readTabBackup()
  if (tab?.byId) mergeStore(memoryById, tab.byId)
  if (!memoryDefault && tab?.defaultPass && tab.defaultPass.trim().length >= 8) {
    memoryDefault = tab.defaultPass.trim()
  }

  await persistEncryptedNow()
  emitChanged()
  return { ok: true, migratedLegacy }
}

export function lockEvidencePassphraseVault(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  memoryById = {}
  memoryDefault = null
  emitChanged()
}

export function purgeEvidencePassphraseVault(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  memoryById = {}
  memoryDefault = null
  removeVaultEncSidecar(EVIDENCE_PASSPHRASE_ENC_LS_KEY)
  clearLegacyPlain()
  clearTabBackup()
  emitChanged()
}

export function hasEncryptedEvidencePassphraseVault(): boolean {
  return hasVaultEncSidecar(EVIDENCE_PASSPHRASE_ENC_LS_KEY)
}

export function setDefaultEvidencePassphrase(passphrase: string): void {
  const pass = passphrase.trim()
  if (pass.length < 8) return
  memoryDefault = pass
  schedulePersist()
  emitChanged()
}

export function getDefaultEvidencePassphrase(): string | null {
  return memoryDefault
}

export function rememberEvidencePassphrase(keys: {
  objectId?: string
  contentHashHex?: string
  digest?: string
  passphrase: string
  asDefault?: boolean
}): void {
  const pass = keys.passphrase.trim()
  if (pass.length < 8) return
  const next = { ...memoryById }
  if (keys.objectId?.trim()) next[normKey(keys.objectId)] = pass
  if (keys.contentHashHex?.trim()) next[`hash:${normKey(keys.contentHashHex)}`] = pass
  if (keys.digest?.trim()) next[`tx:${normKey(keys.digest)}`] = pass
  memoryById = trimStore(next)
  if (keys.asDefault !== false) memoryDefault = pass
  schedulePersist()
  emitChanged()
}

export function lookupEvidencePassphrase(keys: {
  objectId?: string
  contentHashHex?: string
  digest?: string
  allowDefault?: boolean
}): string | null {
  if (keys.objectId?.trim()) {
    const v = memoryById[normKey(keys.objectId)]
    if (v) return v
  }
  if (keys.contentHashHex?.trim()) {
    const v = memoryById[`hash:${normKey(keys.contentHashHex)}`]
    if (v) return v
  }
  if (keys.digest?.trim()) {
    const v = memoryById[`tx:${normKey(keys.digest)}`]
    if (v) return v
  }
  if (keys.allowDefault !== false) return memoryDefault
  return null
}

export function forgetEvidencePassphrase(objectId: string): void {
  const next = { ...memoryById }
  delete next[normKey(objectId)]
  memoryById = next
  schedulePersist()
  emitChanged()
}

/** @deprecated → purgeEvidencePassphraseVault */
export function clearAllEvidencePassphrases(): void {
  purgeEvidencePassphraseVault()
}

export async function flushEvidencePassphraseVaultPersist(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await persistEncryptedNow()
}
