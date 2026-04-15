/** Upper bound to avoid absurd strings in storage / env. */
export const DIRECT_IOTA_RPC_URL_MAX_CHARS = 2048

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Validates and normalizes a user-supplied IOTA JSON-RPC base URL for **direct** client use
 * (browser or Node). No Morgendrot API — only what is passed to `IotaHTTPTransport`.
 *
 * @throws Error if the URL is not a plausible http(s) RPC origin.
 */
export function sanitizeDirectIotaRpcUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('RPC-URL fehlt.')
  if (trimmed.length > DIRECT_IOTA_RPC_URL_MAX_CHARS) {
    throw new Error(`RPC-URL zu lang (max. ${DIRECT_IOTA_RPC_URL_MAX_CHARS} Zeichen).`)
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('RPC-URL ist keine gültige URL.')
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('RPC-URL muss mit http:// oder https:// beginnen.')
  }
  // Reject obvious non-HTTP schemes embedded after normalization
  if (parsed.username || parsed.password) {
    throw new Error('RPC-URL darf keine eingebetteten Credentials enthalten.')
  }
  // Stable form: origin + pathname (no hash; search rare for RPC — strip)
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')
  const origin = `${parsed.protocol}//${parsed.host}`
  return path ? `${origin}${path}` : origin
}
