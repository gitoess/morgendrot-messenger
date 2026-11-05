/**
 * Gerätelokal: Object-ID / contentHash / TX-Digest → Share-Passphrase für ImageNFT.
 * Klartext in localStorage — nur dieses Gerät; max. Einträge, LRU-ähnlich.
 * Bleibt über Vault-Lock erhalten (nur Einsatz-Ende / explizites Leeren).
 */

const LS_KEY = 'morgendrot.evidenceImage.passphrases.v1'
/** Zuletzt genutzte / Mint-Passphrase — Galerie versucht sie für alle gesperrten Einträge. */
const LS_DEFAULT = 'morgendrot.evidenceImage.defaultPassphrase.v1'
const MAX_ENTRIES = 40

type Store = Record<string, string>

function readStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object' || Array.isArray(j)) return {}
    const out: Store = {}
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim().length >= 8) out[k.toLowerCase()] = v.trim()
    }
    return out
  } catch {
    return {}
  }
}

function writeStore(s: Store): void {
  if (typeof window === 'undefined') return
  try {
    const keys = Object.keys(s)
    if (keys.length > MAX_ENTRIES) {
      const drop = keys.slice(0, keys.length - MAX_ENTRIES)
      for (const k of drop) delete s[k]
    }
    window.localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    /* quota / private mode */
  }
}

function normKey(id: string): string {
  return id.trim().toLowerCase()
}

export function setDefaultEvidencePassphrase(passphrase: string): void {
  const pass = passphrase.trim()
  if (typeof window === 'undefined' || pass.length < 8) return
  try {
    window.localStorage.setItem(LS_DEFAULT, pass)
  } catch {
    /* ignore */
  }
}

export function getDefaultEvidencePassphrase(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(LS_DEFAULT)?.trim()
    return v && v.length >= 8 ? v : null
  } catch {
    return null
  }
}

export function rememberEvidencePassphrase(keys: {
  objectId?: string
  contentHashHex?: string
  digest?: string
  passphrase: string
  /** Default: true — Geräte-Standard für Galerie-Auto-Unlock. */
  asDefault?: boolean
}): void {
  const pass = keys.passphrase.trim()
  if (pass.length < 8) return
  const s = readStore()
  if (keys.objectId?.trim()) s[normKey(keys.objectId)] = pass
  if (keys.contentHashHex?.trim()) s[`hash:${normKey(keys.contentHashHex)}`] = pass
  if (keys.digest?.trim()) s[`tx:${normKey(keys.digest)}`] = pass
  writeStore(s)
  if (keys.asDefault !== false) setDefaultEvidencePassphrase(pass)
}

export function lookupEvidencePassphrase(keys: {
  objectId?: string
  contentHashHex?: string
  digest?: string
  /** Default-Passphrase als letzter Fallback (eigene Galerie). */
  allowDefault?: boolean
}): string | null {
  const s = readStore()
  if (keys.objectId?.trim()) {
    const v = s[normKey(keys.objectId)]
    if (v) return v
  }
  if (keys.contentHashHex?.trim()) {
    const v = s[`hash:${normKey(keys.contentHashHex)}`]
    if (v) return v
  }
  if (keys.digest?.trim()) {
    const v = s[`tx:${normKey(keys.digest)}`]
    if (v) return v
  }
  if (keys.allowDefault !== false) return getDefaultEvidencePassphrase()
  return null
}

export function forgetEvidencePassphrase(objectId: string): void {
  const s = readStore()
  delete s[normKey(objectId)]
  writeStore(s)
}

/** Einsatz-Ende / manuell: ImageNFT-Passphrase-Merker + Geräte-Standard leeren. */
export function clearAllEvidencePassphrases(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_KEY)
    window.localStorage.removeItem(LS_DEFAULT)
  } catch {
    /* ignore */
  }
}

export const EVIDENCE_PASSPHRASE_LS_KEY = LS_KEY
export const EVIDENCE_DEFAULT_PASSPHRASE_LS_KEY = LS_DEFAULT
