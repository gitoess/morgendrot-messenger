import { executeCommand } from '@/frontend/lib/api/execute-command'
import { API_BASE } from '@/frontend/lib/api/api-base'
import {
  cacheHandshakeOffers,
  readCachedHandshakeOffers,
} from '@/frontend/lib/handshake-offers-cache'
import type {
  HandshakeOffersFetchResult,
  OutgoingHandshakeOffer,
  PendingHandshakeOffer,
} from '@/frontend/lib/handshake-offers-types'
export type {
  HandshakeOffersFetchResult,
  OutgoingHandshakeOffer,
  PendingHandshakeOffer,
} from '@/frontend/lib/handshake-offers-types'
import {
  canFetchHandshakesViaDirectIota,
  tryFetchHandshakeOffersViaDirectIota,
  tryFindPeerHandshakeViaDirectIota,
} from '@/frontend/lib/direct-iota-handshake-fetch'
import { readClientMailboxIdsForHandshakeScan } from '@/frontend/lib/pending-handshake-mailbox-ids'
import { shouldSkipMessengerApiRelayFallback } from '@/frontend/lib/messenger-standalone-relay'

/** Package-ID in `.morgendrot-package-id` schreiben (wie Terminal `/set-package-id`). */
export const setPackageIdCommand = (packageId0x: string) =>
  executeCommand('/set-package-id', [packageId0x.trim()])

export const startHandshake = (partner: string) => executeCommand('/handshake', [partner])

export const purgeHandshakeOnChainCommand = (recipient: string, sender: string) =>
  executeCommand('/purge-handshake', [recipient.trim(), sender.trim()])

export const connect = (address?: string) =>
  executeCommand('/connect', address ? [address] : [])

export async function fetchHandshakeOffers(): Promise<HandshakeOffersFetchResult> {
  const direct = await tryFetchHandshakeOffersViaDirectIota()
  if (direct?.ok) {
    const offers = Array.isArray(direct.offers) ? direct.offers : []
    const outgoingOffers = Array.isArray(direct.outgoingOffers) ? direct.outgoingOffers : []
    cacheHandshakeOffers(offers, outgoingOffers)
    return { ok: true, offers, outgoingOffers, fromCache: false, liveSource: 'rpc' }
  }

  if (shouldSkipMessengerApiRelayFallback()) {
    const cached = readCachedHandshakeOffers()
    if (cached) {
      return {
        ok: true,
        offers: cached.offers,
        outgoingOffers: cached.outgoingOffers,
        fromCache: true,
        cacheAgeMinutes: cached.ageMinutes,
        liveSource: 'cache',
        error: direct?.error,
      }
    }
    return {
      ok: false,
      offers: [],
      outgoingOffers: [],
      error:
        direct?.error ||
        'Standalone: Handshake-Angebote nur per Direkt-RPC (Handoff, Fullnode-URL, Ketten-IDs).',
      liveSource: 'rpc',
    }
  }

  const ids = readClientMailboxIdsForHandshakeScan()
  const q = ids.length ? `?mailboxIds=${encodeURIComponent(ids.join(','))}` : ''
  try {
    const r = await fetch(`${API_BASE}/api/pending-handshakes${q}`)
    const j = (await r.json()) as {
      ok?: boolean
      offers?: PendingHandshakeOffer[]
      outgoingOffers?: OutgoingHandshakeOffer[]
      error?: string
    }
    if (j.ok === true) {
      const offers = Array.isArray(j.offers) ? j.offers : []
      const outgoingOffers = Array.isArray(j.outgoingOffers) ? j.outgoingOffers : []
      cacheHandshakeOffers(offers, outgoingOffers)
      return { ok: true, offers, outgoingOffers, fromCache: false, liveSource: 'api' }
    }
    const cached = readCachedHandshakeOffers()
    if (cached) {
      return {
        ok: true,
        offers: cached.offers,
        outgoingOffers: cached.outgoingOffers,
        fromCache: true,
        cacheAgeMinutes: cached.ageMinutes,
        liveSource: 'cache',
        error: typeof j.error === 'string' ? j.error : undefined,
      }
    }
    return {
      ok: false,
      offers: [],
      outgoingOffers: [],
      error: typeof j.error === 'string' ? j.error : undefined,
    }
  } catch (e) {
    const cached = readCachedHandshakeOffers()
    if (cached) {
      const msg = e instanceof Error ? e.message : String(e)
      return {
        ok: true,
        offers: cached.offers,
        outgoingOffers: cached.outgoingOffers,
        fromCache: true,
        cacheAgeMinutes: cached.ageMinutes,
        liveSource: 'cache',
        error: msg,
      }
    }
    return {
      ok: false,
      offers: [],
      outgoingOffers: [],
      error: e instanceof Error ? e.message : String(e),
    }
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
  const peerTrim = peer?.trim()
  if (peerTrim && /^0x[a-fA-F0-9]{64}$/.test(peerTrim)) {
    const direct = await tryFindPeerHandshakeViaDirectIota(peerTrim)
    if (direct?.ok) {
      if (direct.found) return direct
      if (canFetchHandshakesViaDirectIota()) return direct
    }
    if (shouldSkipMessengerApiRelayFallback()) {
      return (
        direct ?? {
          ok: false,
          error: 'Standalone: Peer-Handshake nur per Direkt-RPC.',
        }
      )
    }
  }

  const q = peerTrim && /^0x[a-fA-F0-9]{64}$/.test(peerTrim) ? `?peer=${encodeURIComponent(peerTrim)}` : ''
  const r = await fetch(`${API_BASE}/api/find-peer-handshake` + q)
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
