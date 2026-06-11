/**
 * On-chain Purge-Ziel aus Posteingang-Zeile (pairwise vs. Team-Broadcast).
 */
import type { Message } from '@/frontend/lib/types'
import type { PurgeMailboxMessageVariant } from '@morgendrot/core/iota'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type MailboxPurgePairwiseTarget = {
  kind: 'pairwise'
  recipient: string
  peerSender: string
  nonce: string
  variant: PurgeMailboxMessageVariant
  mailboxObjectId?: string
}

export type MailboxPurgeTeamBroadcastTarget = {
  kind: 'team-broadcast'
  teamMailboxObjectId: string
  broadcastSender: string
  nonce: string
}

export type MailboxPurgeTarget = MailboxPurgePairwiseTarget | MailboxPurgeTeamBroadcastTarget

/** Team-Broadcast-Zeile (Empfänger = Team-Mailbox-Object-ID, nicht Wallet-0x). */
export function isTeamBroadcastInboxMessage(msg: Message): boolean {
  if (msg.chainPurgeKind === 'team-broadcast') return true
  const key = (msg.dedupKey ?? msg.id ?? '').trim()
  if (key.startsWith('team:')) return true
  const id = msg.id.trim()
  if (id.startsWith('optimistic:team:')) return true
  return false
}

export function resolveMailboxPurgeTarget(msg: Message, myAddress: string): MailboxPurgeTarget | null {
  if (!msg.chainNonce || !msg.chainPurgeable) return null
  const nonce = msg.chainNonce.trim()
  if (!nonce) return null

  if (isTeamBroadcastInboxMessage(msg)) {
    const teamMb = (msg.recipient ?? '').trim()
    const broadcastSender = msg.from.trim()
    if (!HEX64.test(teamMb) || !HEX64.test(broadcastSender)) return null
    return {
      kind: 'team-broadcast',
      teamMailboxObjectId: teamMb.toLowerCase(),
      broadcastSender: broadcastSender.toLowerCase(),
      nonce,
    }
  }

  const me = myAddress.trim()
  const from = msg.from.trim()
  const to = (msg.recipient ?? '').trim()
  if (!HEX64.test(me) || !HEX64.test(from)) return null
  if (from.toLowerCase() === me.toLowerCase()) {
    if (!HEX64.test(to)) return null
    return {
      kind: 'pairwise',
      recipient: to.toLowerCase(),
      peerSender: me.toLowerCase(),
      nonce,
      variant: msg.encrypted === false ? 'plaintext' : 'encrypted',
    }
  }
  return {
    kind: 'pairwise',
    recipient: me.toLowerCase(),
    peerSender: from.toLowerCase(),
    nonce,
    variant: msg.encrypted === false ? 'plaintext' : 'encrypted',
  }
}

/** @deprecated Nutze resolveMailboxPurgeTarget — nur für Tests/Legacy. */
export function resolveMailboxPurgeAddresses(
  msg: Message,
  myAddress: string
): { recipient: string; peerSender: string } | null {
  const t = resolveMailboxPurgeTarget(msg, myAddress)
  if (!t || t.kind !== 'pairwise') return null
  return { recipient: t.recipient, peerSender: t.peerSender }
}

export function teamBroadcastPurgeHint(msg: Message, myAddress: string): string | null {
  if (!isTeamBroadcastInboxMessage(msg)) return null
  const me = myAddress.trim().toLowerCase()
  const from = msg.from.trim().toLowerCase()
  if (me && from && me !== from) {
    return 'Team-Broadcast: nur der Original-Sender kann vor Ablauf der TTL purgen — danach jeder (Rebate).'
  }
  return null
}
