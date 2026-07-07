'use client'

/**
 * § H.33e — PWA-Adapter für `@morgendrot/core/forensic-batch` (keine duplizierte Prepare-Logik).
 */
import type { Message } from '@/frontend/lib/types'
import { resolveInboxMessageTxDigest } from '@/frontend/lib/einsatz-message-tx-digest'
import {
  buildForensicMsgWire,
  planForensicBatchTxGroups,
  prepareForensicBatchFromMessages as prepareFromCore,
  prepareForensicBatchItem as prepareItemFromCore,
  type ForensicBatchMessageInput,
  type ForensicBatchPreparedItem,
  type ForensicBatchPreparedSkip,
  type ForensicBatchTxPlan,
  type ForensicMsgMetaV1,
  type PlanForensicBatchTxGroupsOpts,
  MORG_FORENSIC_MSG_V1_PREFIX,
  MORG_FORENSIC_MSG_V1_SUFFIX,
} from '@morgendrot/core/forensic-batch'

export {
  buildForensicMsgWire,
  planForensicBatchTxGroups,
  MORG_FORENSIC_MSG_V1_PREFIX,
  MORG_FORENSIC_MSG_V1_SUFFIX,
}
export type {
  ForensicBatchPreparedItem,
  ForensicBatchPreparedSkip,
  ForensicBatchTxPlan,
  ForensicMsgMetaV1,
  PlanForensicBatchTxGroupsOpts,
}

export type PrepareForensicBatchOpts = {
  skipCanonicalRefs?: ReadonlySet<string>
  planOpts?: PlanForensicBatchTxGroupsOpts
}

function mapForensicTransports(
  transports: Message['transports']
): ForensicBatchMessageInput['transports'] {
  if (!transports?.length) return undefined
  return transports.map((t) => (t === 'lan' ? 'internet' : t))
}

export function messageToForensicBatchInput(m: Message): ForensicBatchMessageInput {
  return {
    id: m.id,
    from: m.from,
    recipient: m.recipient,
    content: m.content ?? '',
    timestamp: m.timestamp,
    source:
      m.source === 'mesh' ? 'mesh' : m.source === 'telegram' ? 'telegram' : 'mailbox',
    transports: mapForensicTransports(m.transports),
    chainPurgeKind: m.chainPurgeKind,
    pinnwandPost: m.pinnwandPost,
    chainTxDigest: resolveInboxMessageTxDigest(m),
    chainNonce: m.chainNonce,
  }
}

export async function prepareForensicBatchItem(
  m: Message
): Promise<ForensicBatchPreparedItem | ForensicBatchPreparedSkip> {
  const input = messageToForensicBatchInput(m)
  return prepareItemFromCore(input, (msg) => msg.chainTxDigest)
}

export async function prepareForensicBatchFromMessages(
  messages: readonly Message[],
  opts?: PrepareForensicBatchOpts
) {
  const inputs = messages.map(messageToForensicBatchInput)
  return prepareFromCore(inputs, {
    skipCanonicalRefs: opts?.skipCanonicalRefs,
    planOpts: opts?.planOpts,
    resolveTxDigest: (msg) => msg.chainTxDigest,
  })
}
