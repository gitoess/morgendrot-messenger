/**
 * Explorer-Ziel für Inbox-Zeilen: TX-Digest (wenn bekannt) sonst Mailbox-Objekt.
 */
import type { Message } from '@/frontend/lib/types'
import { resolveInboxMessageTxDigest } from '@/frontend/lib/einsatz-message-tx-digest'
import {
  explorerObjectUrlFromId,
  explorerTxUrlFromDigest,
} from '@/frontend/lib/iota-tx-explorer-hint'
import { readNetworkProfilesState } from '@/frontend/lib/einsatz-network-profiles'

export type InboxExplorerTarget =
  | { kind: 'tx'; digest: string; href: string; networkLabel: string }
  | { kind: 'object'; objectId: string; href: string; networkLabel: string }

function networkLabel(): string {
  try {
    const a = readNetworkProfilesState().active
    if (a === 'testnet') return 'Testnet'
    if (a === 'mainnet') return 'Mainnet'
  } catch {
    /* ignore */
  }
  return 'Explorer'
}

/** Badge-/Menü-Label, z. B. „On-chain (Testnet)“. */
export function inboxExplorerBadgeLabel(target: InboxExplorerTarget): string {
  return `On-chain (${target.networkLabel})`
}

export function resolveInboxMessageExplorerTarget(msg: Message): InboxExplorerTarget | null {
  const digest = resolveInboxMessageTxDigest(msg)
  if (digest) {
    return {
      kind: 'tx',
      digest,
      href: explorerTxUrlFromDigest(digest),
      networkLabel: networkLabel(),
    }
  }
  const mb = (msg.chainMailboxObjectId ?? '').trim()
  if (/^0x[a-fA-F0-9]{64}$/i.test(mb)) {
    return {
      kind: 'object',
      objectId: mb,
      href: explorerObjectUrlFromId(mb),
      networkLabel: networkLabel(),
    }
  }
  return null
}
