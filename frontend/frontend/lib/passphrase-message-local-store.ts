/** Gerätelokal: Wire-Fingerprint → Passphrase (erneut anzeigen / Auto-Entschlüsseln). */

const LS_KEY = 'morgendrot.passphraseMsg.v1'
const MAX_ENTRIES = 60

type Store = Record<string, string>

/** FNV-1a über vollständigen Wire — stabiler als Prefix/Suffix. */
export function fingerprintPassphraseMessageWire(wire: string): string {
  const t = wire.trim()
  let h = 2166136261
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `fnv:${t.length}:${(h >>> 0).toString(16)}`
}

function readStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_KEY)
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

function writeStore(s: Store): void {
  if (typeof window === 'undefined') return
  try {
    const keys = Object.keys(s)
    if (keys.length > MAX_ENTRIES) {
      for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete s[k]
    }
    window.localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function rememberPassphraseMessagePassphrase(wire: string, passphrase: string): void {
  const pass = passphrase.trim()
  if (pass.length < 8 || !wire.trim()) return
  const s = readStore()
  s[fingerprintPassphraseMessageWire(wire)] = pass
  writeStore(s)
}

export function lookupPassphraseMessagePassphrase(wire: string): string | null {
  return readStore()[fingerprintPassphraseMessageWire(wire)] ?? null
}

export function forgetPassphraseMessagePassphrase(wire: string): void {
  const s = readStore()
  delete s[fingerprintPassphraseMessageWire(wire)]
  writeStore(s)
}

/** Vault-Lock / Privacy: alle lokalen Passphrase-Nachrichten-Merker leeren. */
export function clearAllPassphraseMessagePassphrases(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}

export const PASSPHRASE_MESSAGE_LS_KEY = LS_KEY

export const PASSPHRASE_PROTECT_LS_KEY = 'morgendrot.composer.passphraseProtect'

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
