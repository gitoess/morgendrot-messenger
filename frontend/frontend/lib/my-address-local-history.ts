/** Lokale Merkliste bekannter MY_ADDRESS-Werte (nur Browser), für Auswahl/Copy — nicht die Quelle der Wahrheit. */

const STORAGE_KEY = 'morgendrot.knownMyAddressesV1'
const MAX = 24

function normAddr(a: string): string {
  return a.trim().toLowerCase()
}

function isValidHex64(a: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/i.test(a.trim())
}

export function loadKnownMyAddresses(): string[] {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return []
    const p = JSON.parse(raw) as unknown
    if (!Array.isArray(p)) return []
    const out: string[] = []
    for (const x of p) {
      if (typeof x === 'string' && isValidHex64(x)) out.push(x.trim())
    }
    return out
  } catch {
    return []
  }
}

export function recordSeenMyAddress(addr: string | undefined | null): void {
  const a = (addr ?? '').trim()
  if (!isValidHex64(a) || typeof window === 'undefined') return
  try {
    const n = normAddr(a)
    const prev = loadKnownMyAddresses().filter((x) => normAddr(x) !== n)
    const next = [a, ...prev].slice(0, MAX)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

/** Aktuelle Adresse zuerst, dann übrige bekannte, ohne Duplikate. */
export function mergeMyAddressOptions(current: string | undefined | null): string[] {
  const cur = (current ?? '').trim()
  const hist = loadKnownMyAddresses()
  const out: string[] = []
  if (isValidHex64(cur)) out.push(cur)
  for (const h of hist) {
    const t = h.trim()
    if (!isValidHex64(t)) continue
    if (out.some((x) => normAddr(x) === normAddr(t))) continue
    out.push(t)
  }
  return out
}
