/**
 * § H.12 / `docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md` — `canonical_msg_ref` (32 Byte, v1).
 * Reine Krypto über Web Crypto (`crypto.subtle`), lauffähig in Node (Vitest) und Browser.
 */

const te = new TextEncoder()

/** 2^64−1 — ohne BigInt-Literal (Frontend-`tsc` target ES6). */
const U64_MASK = BigInt('18446744073709551615')

export function normalizeMailboxAddressUtf8(addr: string): string {
  const t = addr.trim()
  const m = /^0x([0-9a-fA-F]{64})$/.exec(t)
  if (m) return `0x${m[1].toLowerCase()}`
  return t
}

/** Stabiler Gesprächs-Key aus zwei Wallet-Adressen (sortiert, zeilengetrennt). */
export function stableOfflineMailboxThreadId(addressA: string, addressB: string): string {
  const [x, y] = [normalizeMailboxAddressUtf8(addressA), normalizeMailboxAddressUtf8(addressB)].sort()
  return `${x}\n${y}`
}

async function sha256(u8: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest('SHA-256', new Uint8Array(u8))
  return new Uint8Array(buf)
}

function concatParts(parts: readonly Uint8Array[]): Uint8Array {
  let len = 0
  for (const p of parts) len += p.length
  const out = new Uint8Array(len)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function u64Le(n: bigint): Uint8Array {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setBigUint64(0, n & U64_MASK, true)
  return b
}

/** Wenn kein Protokoll-Nonce: deterministisch aus Sender/Empfänger/Thread/Nutzlast (LE u64 aus SHA-256-Anfang). */
async function deriveMailboxQueueNonceU64(
  sender: string,
  recipient: string,
  threadId: string,
  payloadUtf8: string
): Promise<bigint> {
  const blob = concatParts([
    te.encode(sender),
    Uint8Array.of(0),
    te.encode(recipient),
    Uint8Array.of(0),
    te.encode(threadId),
    Uint8Array.of(0),
    te.encode(payloadUtf8),
  ])
  const h = await sha256(blob)
  return new DataView(h.buffer, h.byteOffset, 8).getBigUint64(0, true)
}

export type ComputeCanonicalMsgRefV1Input = {
  senderAddress?: string
  recipientAddress: string
  threadId?: string
  /** Mailbox-/E2E-Nonce; sonst derive aus Sender+Empfänger+Thread+Nutlast. */
  messageNonceU64?: bigint
  payloadUtf8: string
}

/** 64 Kleinbuchstaben-Hexzeichen (= 32 Byte SHA-256-Ausgabe). */
export async function computeCanonicalMsgRefV1(input: ComputeCanonicalMsgRefV1Input): Promise<string> {
  const sender = normalizeMailboxAddressUtf8(input.senderAddress ?? '')
  const recipient = normalizeMailboxAddressUtf8(input.recipientAddress)
  const thread = input.threadId ?? ''
  const nonce =
    input.messageNonceU64 !== undefined && input.messageNonceU64 !== null
      ? input.messageNonceU64 & U64_MASK
      : await deriveMailboxQueueNonceU64(sender, recipient, thread, input.payloadUtf8)
  const contentHash = await sha256(te.encode(input.payloadUtf8))
  const inner = concatParts([
    te.encode('morg_msg_ref_v1'),
    Uint8Array.of(0),
    te.encode(sender),
    Uint8Array.of(0),
    te.encode(recipient),
    Uint8Array.of(0),
    te.encode(thread),
    Uint8Array.of(0),
    u64Le(nonce),
    Uint8Array.of(0),
    contentHash,
  ])
  const ref = await sha256(inner)
  let hex = ''
  for (let i = 0; i < ref.length; i++) hex += ref[i].toString(16).padStart(2, '0')
  return hex
}
