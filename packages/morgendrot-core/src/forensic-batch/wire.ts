import {
  computeCanonicalMsgRefV1,
  parseMailboxOutNonceMarker,
  stableOfflineMailboxThreadId,
} from '../queue/offline-mailbox'
import {
  FORENSIC_BATCH_ESTIMATED_PTB_OVERHEAD_BYTES,
  FORENSIC_BATCH_MAX_MSGS_PER_TX,
  FORENSIC_BATCH_MAX_TX_WIRE_BYTES,
  FORENSIC_BATCH_MAX_WIRE_UTF8_BYTES,
  MORG_FORENSIC_MSG_V1_PREFIX,
  MORG_FORENSIC_MSG_V1_SUFFIX,
  type ForensicBatchMessageInput,
  type ForensicBatchPreparedItem,
  type ForensicBatchPreparedSkip,
  type ForensicBatchTxPlan,
  type ForensicMsgMetaV1,
} from './types'

/** Web Crypto (Browser + Node 18+) — kein `node:crypto` (Next-Client-Bundle). */
export async function sha256HexUtf8(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('Web Crypto (crypto.subtle) fehlt.')
  const data = new TextEncoder().encode(text)
  const hash = await subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function wireUtf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

function inferChannel(m: ForensicBatchMessageInput): ForensicMsgMetaV1['channel'] {
  if (m.pinnwandPost) return 'pinnwand'
  if (m.chainPurgeKind === 'team-broadcast') return 'group'
  if (m.transports?.includes('telegram') || m.source === 'telegram') return 'telegram'
  return '1:1'
}

function inferTransport(m: ForensicBatchMessageInput): ForensicMsgMetaV1['transport'] {
  if (m.transports?.includes('mesh')) return 'lora'
  if (m.transports?.includes('adhoc')) return 'bluetooth'
  if (m.transports?.includes('telegram')) return 'telegram'
  if (m.source === 'mesh') return 'lora'
  return 'iota'
}

function isLargeBlobWire(content: string): boolean {
  return (
    content.includes('[[MORG_COMPACT_IMG_V1:') ||
    content.includes('[[MORG_LUMA_V1:') ||
    content.includes('[[MORG_CHROMA_V1:') ||
    content.includes('[[MORG_SEG_V1')
  )
}

function parseChainNonceToU64(raw: string | undefined): bigint | undefined {
  if (!raw?.trim()) return undefined
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return undefined
  try {
    const n = BigInt(t)
    if (n < BigInt(0) || n > BigInt('18446744073709551615')) return undefined
    return n
  } catch {
    return undefined
  }
}

export async function buildForensicBatchCanonicalMsgRef(m: ForensicBatchMessageInput): Promise<string> {
  const sender = m.from.trim()
  const recipient = (m.recipient ?? m.from).trim()
  const wire = m.content ?? ''
  const parsed = parseMailboxOutNonceMarker(wire)
  const payloadUtf8 = parsed?.rest ?? wire
  const nonceFromWire = parsed?.nonce
  const nonceFromChain = parseChainNonceToU64(m.chainNonce)
  const messageNonceU64 = nonceFromWire ?? nonceFromChain
  return computeCanonicalMsgRefV1({
    senderAddress: sender,
    recipientAddress: recipient,
    threadId: stableOfflineMailboxThreadId(sender, recipient),
    ...(messageNonceU64 !== undefined ? { messageNonceU64 } : {}),
    payloadUtf8,
  })
}

export function buildForensicMsgWire(meta: ForensicMsgMetaV1, bodyUtf8: string): string {
  return `${MORG_FORENSIC_MSG_V1_PREFIX}${JSON.stringify(meta)}${MORG_FORENSIC_MSG_V1_SUFFIX}\n${bodyUtf8}`
}

export async function prepareForensicBatchItem(
  m: ForensicBatchMessageInput,
  resolveTxDigest?: (msg: ForensicBatchMessageInput) => string | undefined
): Promise<ForensicBatchPreparedItem | ForensicBatchPreparedSkip> {
  const content = m.content ?? ''
  const content_sha256_hex = await sha256HexUtf8(content)
  const canonical_msg_ref = await buildForensicBatchCanonicalMsgRef(m)
  const meta: ForensicMsgMetaV1 = {
    v: 1,
    sender: m.from.trim(),
    recipient: (m.recipient ?? m.from).trim(),
    timestamp_ms: m.timestamp,
    channel: inferChannel(m),
    transport: inferTransport(m),
    content_sha256_hex,
    canonical_msg_ref,
    source_tx_digest: resolveTxDigest?.(m)?.trim() || m.chainTxDigest?.trim() || undefined,
    payload_mode: 'full',
  }
  let body = content
  if (isLargeBlobWire(content)) {
    meta.payload_mode = 'hash_only'
    body = `[blob hash=${content_sha256_hex} len=${content.length}]`
  }
  const wireUtf8 = buildForensicMsgWire(meta, body)
  const wireBytes = wireUtf8ByteLength(wireUtf8)
  if (wireBytes > FORENSIC_BATCH_MAX_WIRE_UTF8_BYTES) {
    if (meta.payload_mode === 'full') {
      meta.payload_mode = 'hash_only'
      const retryWire = buildForensicMsgWire(
        meta,
        `[truncated hash=${content_sha256_hex} len=${content.length}]`
      )
      const retryBytes = wireUtf8ByteLength(retryWire)
      if (retryBytes <= FORENSIC_BATCH_MAX_WIRE_UTF8_BYTES) {
        return { messageId: m.id, wireUtf8: retryWire, wireBytes: retryBytes, meta }
      }
    }
    return {
      messageId: m.id,
      reason: `Wire zu lang (${wireBytes} B, max ${FORENSIC_BATCH_MAX_WIRE_UTF8_BYTES}).`,
    }
  }
  return { messageId: m.id, wireUtf8, wireBytes, meta }
}

export type PlanForensicBatchTxGroupsOpts = {
  maxMsgsPerTx?: number
  maxWireUtf8Bytes?: number
  maxTxWireBytes?: number
  mode?: 'plaintext' | 'encrypted'
}

export function planForensicBatchTxGroups(
  prepared: readonly ForensicBatchPreparedItem[],
  opts?: PlanForensicBatchTxGroupsOpts
): ForensicBatchTxPlan[] {
  const maxMsgs = opts?.maxMsgsPerTx ?? FORENSIC_BATCH_MAX_MSGS_PER_TX
  const maxWire = opts?.maxWireUtf8Bytes ?? FORENSIC_BATCH_MAX_WIRE_UTF8_BYTES
  const maxTxBytes = opts?.maxTxWireBytes ?? FORENSIC_BATCH_MAX_TX_WIRE_BYTES
  const mode = opts?.mode ?? 'plaintext'
  const plans: ForensicBatchTxPlan[] = []
  let bucket: ForensicBatchPreparedItem[] = []
  let bucketBytes = 0

  const flush = () => {
    if (!bucket.length) return
    plans.push({ batchIndex: plans.length, items: bucket, totalWireBytes: bucketBytes, mode })
    bucket = []
    bucketBytes = 0
  }

  const wouldExceedTxBudget = (nextBytes: number) =>
    FORENSIC_BATCH_ESTIMATED_PTB_OVERHEAD_BYTES + bucketBytes + nextBytes > maxTxBytes

  for (const item of prepared) {
    if (item.wireBytes > maxWire) continue
    if (bucket.length >= maxMsgs || (bucket.length > 0 && wouldExceedTxBudget(item.wireBytes))) {
      flush()
    }
    if (wouldExceedTxBudget(item.wireBytes) && bucket.length === 0) {
      bucket.push(item)
      bucketBytes += item.wireBytes
      flush()
      continue
    }
    bucket.push(item)
    bucketBytes += item.wireBytes
  }
  flush()
  return plans
}

export async function prepareForensicBatchFromMessages(
  messages: readonly ForensicBatchMessageInput[],
  opts?: {
    skipCanonicalRefs?: ReadonlySet<string>
    planOpts?: PlanForensicBatchTxGroupsOpts
    resolveTxDigest?: (msg: ForensicBatchMessageInput) => string | undefined
  }
): Promise<{
  prepared: ForensicBatchPreparedItem[]
  skipped: ForensicBatchPreparedSkip[]
  alreadyBatched: number
  plans: ForensicBatchTxPlan[]
}> {
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  const prepared: ForensicBatchPreparedItem[] = []
  const skipped: ForensicBatchPreparedSkip[] = []
  let alreadyBatched = 0
  for (const m of sorted) {
    const out = await prepareForensicBatchItem(m, opts?.resolveTxDigest)
    if ('reason' in out) {
      skipped.push(out)
      continue
    }
    if (opts?.skipCanonicalRefs?.has(out.meta.canonical_msg_ref.toLowerCase())) {
      alreadyBatched++
      continue
    }
    prepared.push(out)
  }
  return {
    prepared,
    skipped,
    alreadyBatched,
    plans: planForensicBatchTxGroups(prepared, opts?.planOpts),
  }
}
