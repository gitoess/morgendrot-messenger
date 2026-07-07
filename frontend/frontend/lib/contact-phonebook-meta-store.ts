/** Client-only Metadaten: Favoriten, Zuletzt kontaktiert, lokal ausgeblendet. */

const FAVORITES_KEY = 'morgendrot.contactPhonebook.favorites'
const LAST_CONTACT_KEY = 'morgendrot.contactPhonebook.lastContact'
const HIDDEN_KEY = 'morgendrot.contactPhonebook.hidden'

export const CONTACT_PHONEBOOK_META_CHANGED_EVENT = 'morgendrot.contactPhonebookMetaChanged' as const

function notifyContactPhonebookMetaChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CONTACT_PHONEBOOK_META_CHANGED_EVENT))
}

function norm(addr: string): string {
  return addr.trim().toLowerCase()
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function readContactFavorites(): Set<string> {
  const arr = readJson<string[]>(FAVORITES_KEY, [])
  return new Set(arr.map(norm).filter((a) => /^0x[a-f0-9]{64}$/.test(a)))
}

export function toggleContactFavorite(address: string): boolean {
  const a = norm(address)
  const set = readContactFavorites()
  const next = new Set(set)
  if (next.has(a)) next.delete(a)
  else next.add(a)
  writeJson(FAVORITES_KEY, [...next])
  notifyContactPhonebookMetaChanged()
  return next.has(a)
}

export function readContactLastContacted(): Record<string, number> {
  const raw = readJson<Record<string, number>>(LAST_CONTACT_KEY, {})
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    const a = norm(k)
    if (/^0x[a-f0-9]{64}$/.test(a) && Number.isFinite(v)) out[a] = v
  }
  return out
}

export function recordContactLastContacted(address: string, at = Date.now()): void {
  const a = norm(address)
  if (!/^0x[a-f0-9]{64}$/.test(a)) return
  const map = readContactLastContacted()
  map[a] = at
  writeJson(LAST_CONTACT_KEY, map)
  notifyContactPhonebookMetaChanged()
}

export function readHiddenContacts(): Set<string> {
  const arr = readJson<string[]>(HIDDEN_KEY, [])
  return new Set(arr.map(norm).filter((a) => /^0x[a-f0-9]{64}$/.test(a)))
}

export function hideContactFromPhonebook(address: string): void {
  const a = norm(address)
  const set = readHiddenContacts()
  set.add(a)
  writeJson(HIDDEN_KEY, [...set])
  const fav = readContactFavorites()
  if (fav.has(a)) {
    fav.delete(a)
    writeJson(FAVORITES_KEY, [...fav])
  }
  notifyContactPhonebookMetaChanged()
}

/** Ausgeblendeten Kontakt wieder in der Telefonbuch-Liste anzeigen. */
export function showContactInPhonebook(address: string): void {
  const a = norm(address)
  const set = readHiddenContacts()
  if (!set.has(a)) return
  set.delete(a)
  writeJson(HIDDEN_KEY, [...set])
  notifyContactPhonebookMetaChanged()
}
