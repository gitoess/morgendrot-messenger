/** Kurzzeit-Cache für On-Chain-Handshake-Sonden — verhindert UI-Flackern bei Poll/Re-Renders. */

const POSITIVE_TTL_MS = 10 * 60_000
const NEGATIVE_TTL_MS = 3 * 60_000

type ProbeEntry = { found: boolean; at: number }

const cache = new Map<string, ProbeEntry>()

function norm(addr: string): string {
  return addr.trim().toLowerCase()
}

export function getCachedChainHandshakeProbe(addr: string): 'found' | 'not_found' | null {
  const key = norm(addr)
  const hit = cache.get(key)
  if (!hit) return null
  const ttl = hit.found ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS
  if (Date.now() - hit.at > ttl) {
    cache.delete(key)
    return null
  }
  return hit.found ? 'found' : 'not_found'
}

export function setCachedChainHandshakeProbe(addr: string, found: boolean): void {
  cache.set(norm(addr), { found, at: Date.now() })
}

export function invalidateChainHandshakeProbe(addr: string): void {
  cache.delete(norm(addr))
}

export function shouldRunChainHandshakeProbe(addr: string): boolean {
  return getCachedChainHandshakeProbe(addr) == null
}
