export const IOTA_TESTNET_FAUCET_BASE = 'https://faucet.testnet.iota.cafe'

const ADDR_RE = /^0x[a-fA-F0-9]{64}$/i

/** Basis-URL normalisieren (ohne Query/Hash) — bei Ungültigkeit Standard. */
export function normalizeIotaTestnetFaucetBase(raw?: string | null): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) return IOTA_TESTNET_FAUCET_BASE
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return IOTA_TESTNET_FAUCET_BASE
    u.search = ''
    u.hash = ''
    const out = u.toString().replace(/\/$/, '')
    return out || IOTA_TESTNET_FAUCET_BASE
  } catch {
    return IOTA_TESTNET_FAUCET_BASE
  }
}

export function isHttpUrl(raw?: string | null): boolean {
  const trimmed = (raw || '').trim()
  if (!trimmed) return false
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export type BuildIotaTestnetFaucetUrlOptions = {
  /** Eigene Faucet-Basis (z. B. wenn sich der offizielle Host ändert). */
  baseUrl?: string | null
}

/** Web-Faucet mit optional vorausgefüllter Adresse (`?address=0x…`). */
export function buildIotaTestnetFaucetUrl(
  recipient?: string,
  opts?: BuildIotaTestnetFaucetUrlOptions
): string {
  const base = normalizeIotaTestnetFaucetBase(opts?.baseUrl)
  const url = new URL(base.endsWith('/') ? base : `${base}/`)
  const addr = recipient?.trim()
  if (addr && ADDR_RE.test(addr)) {
    url.searchParams.set('address', addr)
  }
  return url.toString()
}
