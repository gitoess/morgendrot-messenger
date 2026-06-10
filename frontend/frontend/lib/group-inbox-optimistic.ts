/**
 * Nach Gruppen-Send: sofort sichtbare Posteingang-Zeilen (bis Chain-Reload nachzieht).
 */
import type { Message } from '@/frontend/lib/types'
import { mergeAllMessages } from '@/frontend/lib/message-dedup'
import { addressMatchesIdentity } from '@/frontend/features/inbox/inbox-partner-filter'
import { pickLocalOverlayRowsForInboxMerge } from '@/frontend/lib/mesh-local-archive'

const OPTIMISTIC_MAX_AGE_MS = 12 * 60 * 1000

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export function isPendingMailboxOptimisticRow(msg: Message): boolean {
  return typeof msg.id === 'string' && msg.id.startsWith('optimistic:')
}

/** Chain-Zeile bestätigt eine optimistic-Zeile (gleiche Nonce + Empfänger). */
export function chainMessageConfirmsOptimisticRow(chain: Message, optimistic: Message): boolean {
  if (!isPendingMailboxOptimisticRow(optimistic)) return false
  if (Date.now() - optimistic.timestamp > OPTIMISTIC_MAX_AGE_MS) return false
  if (!addressMatchesIdentity(chain.from, optimistic.from) && norm(chain.from) !== norm(optimistic.from)) {
    return false
  }
  const optNonce = optimistic.chainNonce?.trim()
  const chainNonce = chain.chainNonce?.trim()
  if (optNonce && chainNonce && optNonce !== chainNonce) return false
  const optRecip = norm(optimistic.recipient ?? '')
  const chainRecip = norm(chain.recipient ?? '')
  if (!optRecip || !chainRecip || optRecip !== chainRecip) return false
  if (optimistic.dedupKey && chain.dedupKey && optimistic.dedupKey === chain.dedupKey) return true
  if (optNonce && chainNonce && optNonce === chainNonce) return true
  return false
}

/** Optimistic-Zeilen, die noch nicht von einem Chain-Fetch bestätigt wurden. */
export function pickUnconfirmedMailboxOptimisticRows(prev: Message[], chainRows: Message[]): Message[] {
  const pending = prev.filter(isPendingMailboxOptimisticRow)
  if (pending.length === 0) return []
  return pending.filter(
    (opt) =>
      Date.now() - opt.timestamp <= OPTIMISTIC_MAX_AGE_MS &&
      !chainRows.some((chain) => chainMessageConfirmsOptimisticRow(chain, opt))
  )
}

/** Mesh/Telegram/optimistic — beim Mailbox-Reset mit Chain-Seite mergen. */
export function pickInboxOverlayRowsForMerge(prev: Message[], chainRows: Message[] = []): Message[] {
  const meshTg = pickLocalOverlayRowsForInboxMerge(prev)
  const optimistic = pickUnconfirmedMailboxOptimisticRows(prev, chainRows)
  const seen = new Set(meshTg.map((m) => m.id))
  const extra = optimistic.filter((m) => !seen.has(m.id))
  return [...meshTg, ...extra]
}

export function buildGroupMailboxOptimisticInboxRows(p: {
  myAddress: string
  text: string
  encrypted: boolean
  messageNonceU64: bigint
  mode: 'team-broadcast' | 'pairwise'
  teamMailboxObjectId?: string | null
  pairwiseTargets?: string[]
}): Message[] {
  const me = p.myAddress.trim()
  if (!me.startsWith('0x')) return []
  const content = p.text.trim()
  if (!content) return []
  const ts = Date.now()
  const nonce = p.messageNonceU64.toString()
  const base = {
    from: me,
    content,
    timestamp: ts,
    encrypted: p.encrypted,
    source: 'mailbox' as const,
    transports: ['internet'] as ('internet' | 'mesh' | 'adhoc')[],
    chainNonce: nonce,
    chainPurgeable: true,
  }

  if (p.mode === 'team-broadcast') {
    const teamMb = p.teamMailboxObjectId?.trim().toLowerCase()
    if (!teamMb) return []
    return [
      {
        ...base,
        id: `optimistic:team:${teamMb}:${nonce}`,
        recipient: teamMb,
        dedupKey: `team:${teamMb}:${me.toLowerCase()}:${nonce}`,
      },
    ]
  }

  const targets = (p.pairwiseTargets ?? []).map((t) => t.trim().toLowerCase()).filter((t) => /^0x[a-f0-9]{64}$/.test(t))
  if (targets.length === 0) return []
  return targets.map((recipient, i) => ({
    ...base,
    id: `optimistic:pairwise:${recipient}:${nonce}:${i}`,
    recipient,
    dedupKey: `chain|${me.toLowerCase()}|${recipient}|${nonce}|${ts}`,
  }))
}

export function mergeOptimisticGroupInboxRows(prev: Message[], rows: Message[]): Message[] {
  if (rows.length === 0) return prev
  return mergeAllMessages([...rows, ...prev]).sort((a, b) => b.timestamp - a.timestamp)
}
