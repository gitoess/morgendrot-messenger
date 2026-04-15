/**
 * Optionaler Outbound-Marker für Mailbox-Wire (Klartext vor serverseitigem ECDH).
 * Server (`sendEncryptedMessage` / `sendPlaintextOnly`) strippt und nutzt `n` als Move-**u64**-Nonce.
 * § H.12: `parseMailboxProtocolNonceU64FromWire` für `canonical_msg_ref` / Offline-Queue.
 */

const PREFIX = '[[MORG_MAILBOX_NONCE_V1:' as const
const SUFFIX = ']]' as const

const U64_MAX = BigInt('18446744073709551615')

export type ParsedMailboxOutNonce = {
  nonce: bigint
  /** Nutzlast ohne Marker-Zeile (für E2EE / Klartext an Move). */
  rest: string
}

function assertU64(n: bigint): void {
  if (n < BigInt(0) || n > U64_MAX) {
    throw new Error('MORG_MAILBOX_NONCE_V1: n muss eine gültige u64 sein (0 … 2^64−1).')
  }
}

/**
 * Erkennt führenden Marker; bei defektem JSON nach Präfix **`null`** (kein Marker),
 * damit der String als normaler Text verschlüsselt werden kann.
 */
export function parseMailboxOutNonceMarker(wire: string): ParsedMailboxOutNonce | null {
  if (!wire.startsWith(PREFIX)) return null
  const closeIdx = wire.indexOf(SUFFIX, PREFIX.length)
  if (closeIdx < 0) return null
  const jsonPart = wire.slice(PREFIX.length, closeIdx)
  let o: unknown
  try {
    o = JSON.parse(jsonPart) as unknown
  } catch {
    return null
  }
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null
  const nStr = typeof (o as { n?: unknown }).n === 'string' ? String((o as { n: string }).n).trim() : ''
  if (!/^\d+$/.test(nStr)) return null
  const nonce = BigInt(nStr)
  try {
    assertU64(nonce)
  } catch {
    return null
  }
  const after = wire.slice(closeIdx + SUFFIX.length)
  const rest = after.startsWith('\n') ? after.slice(1) : after
  return { nonce, rest }
}

/** Nur `nonce`, wenn ein gültiger Marker vorn steht — sonst `null` (Caller: Fallback). */
export function parseMailboxProtocolNonceU64FromWire(wire: string): bigint | null {
  const p = parseMailboxOutNonceMarker(wire)
  return p ? p.nonce : null
}

export function prependMailboxOutNonceMarker(body: string, nonce: bigint): string {
  assertU64(nonce)
  const inner = JSON.stringify({ n: nonce.toString(10) })
  const head = `${PREFIX}${inner}${SUFFIX}`
  const b = body ?? ''
  if (!b) return head
  return `${head}\n${b}`
}
