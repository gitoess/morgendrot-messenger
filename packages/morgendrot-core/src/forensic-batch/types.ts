export const MORG_FORENSIC_MSG_V1_PREFIX = '[[MORG_FORENSIC_MSG_V1:'
export const MORG_FORENSIC_MSG_V1_SUFFIX = ']]'

export const FORENSIC_BATCH_MAX_MSGS_PER_TX = 50
export const FORENSIC_BATCH_MAX_TX_WIRE_BYTES = 400_000
export const FORENSIC_BATCH_ESTIMATED_PTB_OVERHEAD_BYTES = 2_048
export const FORENSIC_BATCH_MAX_WIRE_UTF8_BYTES = 16_000

export type ForensicMsgMetaV1 = {
  v: 1
  sender: string
  recipient: string
  timestamp_ms: number
  channel: '1:1' | 'group' | 'pinnwand' | 'telegram'
  transport: 'iota' | 'lora' | 'bluetooth' | 'sneakernet' | 'telegram'
  content_sha256_hex: string
  canonical_msg_ref: string
  source_tx_digest?: string
  payload_mode: 'full' | 'hash_only'
}

export type ForensicBatchMessageInput = {
  id: string
  from: string
  recipient?: string
  content: string
  timestamp: number
  source?: 'mailbox' | 'mesh' | 'telegram'
  transports?: Array<'internet' | 'mesh' | 'adhoc' | 'telegram'>
  chainPurgeKind?: 'pairwise' | 'team-broadcast'
  pinnwandPost?: boolean
  chainTxDigest?: string
  chainNonce?: string
}

export type ForensicBatchPreparedItem = {
  messageId: string
  wireUtf8: string
  wireBytes: number
  meta: ForensicMsgMetaV1
}

export type ForensicBatchPreparedSkip = {
  messageId: string
  reason: string
}

export type ForensicBatchTxPlan = {
  batchIndex: number
  items: ForensicBatchPreparedItem[]
  totalWireBytes: number
  mode: 'plaintext' | 'encrypted'
}
