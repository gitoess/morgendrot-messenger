import { executeCommand } from '@/frontend/lib/api/execute-command'
import { API_BASE } from '@/frontend/lib/api/api-base'
import { readClientMailboxIdsForHandshakeScan } from '@/frontend/lib/pending-handshake-mailbox-ids'

/** Package-ID in `.morgendrot-package-id` schreiben (wie Terminal `/set-package-id`). */
export const setPackageIdCommand = (packageId0x: string) =>
  executeCommand('/set-package-id', [packageId0x.trim()])

export const startHandshake = (partner: string) => executeCommand('/handshake', [partner])

export const purgeHandshakeOnChainCommand = (recipient: string, sender: string) =>
  executeCommand('/purge-handshake', [recipient.trim(), sender.trim()])

export const connect = (address?: string) =>
  executeCommand('/connect', address ? [address] : [])

export type PendingHandshakeOffer = {
  sender: string
  nonce: string
  source: 'mailbox' | 'event'
}

export type OutgoingHandshakeOffer = {
  recipient: string
  nonce: string
  source: 'mailbox' | 'event'
}

export type HandshakeOffersFetchResult = {
  ok: boolean
  offers?: PendingHandshakeOffer[]
  outgoingOffers?: OutgoingHandshakeOffer[]
  error?: string
}

export async function fetchHandshakeOffers(): Promise<HandshakeOffersFetchResult> {
  const ids = readClientMailboxIdsForHandshakeScan()
  const q = ids.length ? `?mailboxIds=${encodeURIComponent(ids.join(','))}` : ''
  const r = await fetch(`${API_BASE}/api/pending-handshakes${q}`)
  const j = (await r.json()) as {
    ok?: boolean
    offers?: PendingHandshakeOffer[]
    outgoingOffers?: OutgoingHandshakeOffer[]
    error?: string
  }
  return {
    ok: j.ok === true,
    offers: Array.isArray(j.offers) ? j.offers : [],
    outgoingOffers: Array.isArray(j.outgoingOffers) ? j.outgoingOffers : [],
    error: typeof j.error === 'string' ? j.error : undefined,
  }
}

/** @deprecated Alias — nutzt `fetchHandshakeOffers`. */
export async function fetchPendingHandshakes(): Promise<HandshakeOffersFetchResult> {
  return fetchHandshakeOffers()
}

export async function findPeerHandshake(peer?: string): Promise<{
  ok: boolean
  found?: boolean
  sender?: string
  nonce?: string
  peerPubRawBase64?: string
  error?: string
}> {
  const q = peer && /^0x[a-fA-F0-9]{64}$/.test(peer.trim()) ? `?peer=${encodeURIComponent(peer.trim())}` : ''
  const r = await fetch('/api/find-peer-handshake' + q)
  const j = (await r.json()) as {
    ok?: boolean
    found?: boolean
    sender?: string
    nonce?: string
    peerPubRawBase64?: string
    error?: string
  }
  return {
    ok: j.ok === true,
    found: j.found === true,
    sender: typeof j.sender === 'string' ? j.sender : undefined,
    nonce: typeof j.nonce === 'string' ? j.nonce : undefined,
    peerPubRawBase64: typeof j.peerPubRawBase64 === 'string' ? j.peerPubRawBase64 : undefined,
    error: typeof j.error === 'string' ? j.error : undefined,
  }
}
