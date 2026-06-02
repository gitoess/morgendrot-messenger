export const MAILBOX_INBOX_HEX64 = /^0x[a-fA-F0-9]{64}$/i

export function normalizeMailboxAddress(a: string): string {
  const t = String(a || '').trim().toLowerCase()
  return t.startsWith('0x') ? t : `0x${t}`
}

export function messagingStructType(
  packageId: string,
  local: 'MsgKey' | 'PlainMsgKey' | 'HsKey'
): string {
  const pkg = packageId.trim()
  if (!MAILBOX_INBOX_HEX64.test(pkg)) throw new Error('PACKAGE_ID ungültig.')
  return `${pkg}::messaging::${local}`
}

/** Move `vector<u8>` aus RPC-`fields` (Zahlenarray oder Uint8Array). */
export function coerceMoveU8Vector(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v
  if (Array.isArray(v)) {
    return new Uint8Array(v.map((x) => (typeof x === 'number' ? x & 0xff : Number(x) & 0xff)))
  }
  if (v && typeof v === 'object' && Array.isArray((v as { vec?: unknown }).vec)) {
    return coerceMoveU8Vector((v as { vec: unknown }).vec)
  }
  return new Uint8Array()
}
