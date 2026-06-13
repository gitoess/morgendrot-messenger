import { normalizeMailboxAddress } from './mailbox-inbox-rpc-helpers'

/** Gleiche On-Chain-Nachricht (Sender/Empfänger/Nonce) — unabhängig von Event vs. Mailbox-DF. */
export function chainMessageLogicalDedupKey(parts: {
  sender: string
  recipient?: string
  nonce: string | number | bigint
}): string | null {
  const from = normalizeMailboxAddress(parts.sender)
  const to = normalizeMailboxAddress(parts.recipient ?? '')
  const nonce = String(parts.nonce ?? '').trim()
  if (!from.startsWith('0x') || !nonce) return null
  return `chain-msg|${from}|${to}|${nonce}`
}

/** Kleine nonce (z. B. `1`) — `evid:` / `mbp:` zur Trennung mehrerer Events behalten. */
export function nonceNeedsInboxKeyDisambiguation(nonce: string | number | bigint): boolean {
  const n = String(nonce ?? '').trim()
  if (!n) return true
  try {
    const bi = BigInt(n)
    if (bi >= 1_000_000_000_000n) return false
  } catch {
    return true
  }
  const num = Number(n)
  return !Number.isFinite(num) || num < 1_000_000_000_000
}

export function mailboxPlainInboxKey(parts: {
  sender: string
  recipient: string
  nonce: string | number | bigint
  tsMs?: number
}): string {
  return `mbp:${normalizeMailboxAddress(parts.sender)}:${normalizeMailboxAddress(parts.recipient)}:${String(parts.nonce)}:${parts.tsMs ?? 0}`
}

export function mailboxEncryptedInboxKey(parts: {
  sender: string
  recipient: string
  nonce: string | number | bigint
  tsMs?: number
}): string {
  return `mb:${normalizeMailboxAddress(parts.sender)}:${normalizeMailboxAddress(parts.recipient)}:${String(parts.nonce)}:${parts.tsMs ?? 0}`
}

export function resolveInboxRowDedupKey(parts: {
  sender: string
  recipient?: string
  nonce?: string
  timestamp: number
  inboxKey?: string
  content?: string
  fallbackContentDedupKey?: string
}): string {
  const nonceStr = (parts.nonce ?? '').trim()
  const inboxKey = (parts.inboxKey ?? '').trim()
  const logical =
    nonceStr.length > 0
      ? chainMessageLogicalDedupKey({ sender: parts.sender, recipient: parts.recipient, nonce: nonceStr })
      : null
  if (logical && !nonceNeedsInboxKeyDisambiguation(nonceStr)) return logical
  if (inboxKey) return inboxKey
  if (logical) return logical
  return parts.fallbackContentDedupKey ?? ''
}
