'use client'

export type TxRelayEnvelopeV1 = {
  version: 'MORG_TX_RELAY_V1'
  mode: 'submit_ready' | 'sponsored'
  networkId: string
  sender: string
  createdAt: number
  expiresAt: number
  nonce: string
  payloadEncoding: string
  payload: string
  payloadHash: string
  senderSig: string
  recipient?: string
}

export type TxRelayQueueStatus = 'pending' | 'expired_local_proof' | 'anchored' | 'invalid' | 'draft_unsigned'

export type TxRelayQueueItem = {
  id: string
  status: TxRelayQueueStatus
  envelope: TxRelayEnvelopeV1
  createdLocalAt: number
  txDigest?: string
  relayReport?: {
    rpcStatus?: 'submitted' | 'reject' | 'error'
    errorCode?: string
    note?: string
    updatedAt: number
  }
}

const LS_KEY = 'morgendrot.txRelayQueue.v1'

export function loadTxRelayQueue(): TxRelayQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is TxRelayQueueItem => !!x && typeof x === 'object')
  } catch {
    return []
  }
}

function saveTxRelayQueue(items: TxRelayQueueItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

export function validateRelayEnvelope(input: unknown): { ok: true; envelope: TxRelayEnvelopeV1 } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Envelope muss ein JSON-Objekt sein.' }
  }
  const e = input as Partial<TxRelayEnvelopeV1>
  if (e.version !== 'MORG_TX_RELAY_V1') return { ok: false, error: 'version muss MORG_TX_RELAY_V1 sein.' }
  if (e.mode !== 'submit_ready' && e.mode !== 'sponsored') return { ok: false, error: 'mode ungültig.' }
  if (typeof e.networkId !== 'string' || !e.networkId.trim()) return { ok: false, error: 'networkId fehlt.' }
  if (typeof e.sender !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(e.sender.trim())) return { ok: false, error: 'sender muss 0x-Adresse sein.' }
  if (!Number.isFinite(e.createdAt) || !Number.isFinite(e.expiresAt)) return { ok: false, error: 'createdAt/expiresAt müssen Zahlen sein.' }
  if (Number(e.expiresAt) < Number(e.createdAt)) return { ok: false, error: 'expiresAt muss >= createdAt sein.' }
  if (typeof e.nonce !== 'string' || !e.nonce.trim()) return { ok: false, error: 'nonce fehlt.' }
  if (typeof e.payloadEncoding !== 'string' || !e.payloadEncoding.trim()) return { ok: false, error: 'payloadEncoding fehlt.' }
  if (typeof e.payload !== 'string' || !e.payload.trim()) return { ok: false, error: 'payload fehlt.' }
  if (typeof e.payloadHash !== 'string' || !e.payloadHash.trim()) return { ok: false, error: 'payloadHash fehlt.' }
  if (typeof e.senderSig !== 'string' || !e.senderSig.trim()) return { ok: false, error: 'senderSig fehlt.' }
  if (e.recipient != null && (typeof e.recipient !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(e.recipient.trim()))) {
    return { ok: false, error: 'recipient muss (optional) eine gültige 0x-Adresse sein.' }
  }
  return { ok: true, envelope: e as TxRelayEnvelopeV1 }
}

export function enqueueRelayEnvelope(envelope: TxRelayEnvelopeV1): TxRelayQueueItem {
  const now = Date.now()
  const status: TxRelayQueueStatus = envelope.expiresAt < now ? 'expired_local_proof' : 'pending'
  const item: TxRelayQueueItem = {
    id: `${envelope.nonce}:${now}`,
    status,
    envelope,
    createdLocalAt: now,
  }
  const prev = loadTxRelayQueue()
  const deduped = prev.filter(
    (x) => !(x.envelope.nonce === envelope.nonce && x.envelope.sender.toLowerCase() === envelope.sender.toLowerCase())
  )
  saveTxRelayQueue([item, ...deduped])
  return item
}

export function markRelayQueueAnchored(id: string, txDigest: string) {
  const items = loadTxRelayQueue()
  const next: TxRelayQueueItem[] = items.map((x) =>
    x.id === id
      ? {
          ...x,
          status: 'anchored' as const,
          txDigest,
          relayReport: {
            rpcStatus: 'submitted',
            errorCode: x.relayReport?.errorCode,
            note: x.relayReport?.note,
            updatedAt: Date.now(),
          },
        }
      : x
  )
  saveTxRelayQueue(next)
}

export function updateRelayQueueReport(
  id: string,
  report: {
    rpcStatus?: 'submitted' | 'reject' | 'error'
    errorCode?: string
    note?: string
    statusOverride?: TxRelayQueueStatus
  }
) {
  const items = loadTxRelayQueue()
  const next = items.map((x) =>
    x.id === id
      ? {
          ...x,
          status: report.statusOverride ?? x.status,
          relayReport: {
            rpcStatus: report.rpcStatus ?? x.relayReport?.rpcStatus,
            errorCode: report.errorCode ?? x.relayReport?.errorCode,
            note: report.note ?? x.relayReport?.note,
            updatedAt: Date.now(),
          },
        }
      : x
  )
  saveTxRelayQueue(next)
}

export function removeRelayQueueItem(id: string) {
  const items = loadTxRelayQueue()
  const next = items.filter((x) => x.id !== id)
  saveTxRelayQueue(next)
}
