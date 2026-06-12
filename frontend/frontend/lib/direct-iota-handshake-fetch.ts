'use client'

/**
 * § H.15 B.2 on-chain: Handshake-Angebote und Peer-Lookup per Fullnode (ohne /api/pending-handshakes).
 */

import {
  createDirectIotaClient,
  findPeerHandshakeFromRpc,
  listIncomingHandshakeOffersRpc,
  listOutgoingHandshakeOffersRpc,
} from '@morgendrot/core/iota'
import type {
  HandshakeOffersFetchResult,
  OutgoingHandshakeOffer,
  PendingHandshakeOffer,
} from '@/frontend/lib/handshake-offers-types'
import { getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { readClientMailboxIdsForHandshakeScan } from '@/frontend/lib/pending-handshake-mailbox-ids'
import { uint8ToBase64 } from '@morgendrot/shared/bytes-base64'

export function canFetchHandshakesViaDirectIota(): boolean {
  if (isIotaRelayOnlyMode()) return false
  if (!getConfiguredDirectIotaRpcUrl()) return false
  const snap = getDirectMailboxChainSnapshot()
  if (!snap?.packageId?.trim() || !snap.senderAddress?.trim()) return false
  return true
}

function collectMailboxIdsForHandshakeScan(): string[] {
  const snap = getDirectMailboxChainSnapshot()
  const ids = [...readClientMailboxIdsForHandshakeScan()]
  const mb = snap?.mailboxId?.trim()
  if (mb) ids.push(mb)
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const id = raw.trim()
    const k = id.toLowerCase()
    if (!/^0x[a-fA-F0-9]{64}$/.test(id) || seen.has(k)) continue
    seen.add(k)
    out.push(id)
  }
  return out
}

export async function tryFetchHandshakeOffersViaDirectIota(): Promise<HandshakeOffersFetchResult | null> {
  if (!canFetchHandshakesViaDirectIota()) return null
  const rpc = getConfiguredDirectIotaRpcUrl()
  const snap = getDirectMailboxChainSnapshot()
  if (!rpc || !snap) return null

  const mailboxObjectIds = collectMailboxIdsForHandshakeScan()
  // EcdhInit-Events brauchen keine Mailbox — Consumer/Wanderer oft nur Wallet + Event-Handshake.

  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const base = {
      packageId: snap.packageId.trim(),
      myAddress: snap.senderAddress.trim(),
      mailboxObjectIds,
      limit: 25,
    }
    const [offers, outgoingOffers] = await Promise.all([
      listIncomingHandshakeOffersRpc(client, base),
      listOutgoingHandshakeOffersRpc(client, base),
    ])
    return {
      ok: true,
      offers: offers as PendingHandshakeOffer[],
      outgoingOffers: outgoingOffers as OutgoingHandshakeOffer[],
      fromCache: false,
      liveSource: 'rpc',
    }
  } catch (e) {
    return {
      ok: false,
      offers: [],
      outgoingOffers: [],
      error: formatDirectIotaSubmitError(e),
    }
  }
}

export async function tryFindPeerHandshakeViaDirectIota(peer: string): Promise<{
  ok: boolean
  found?: boolean
  sender?: string
  nonce?: string
  peerPubRawBase64?: string
  error?: string
} | null> {
  if (!canFetchHandshakesViaDirectIota()) return null
  const p = peer.trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(p)) return null

  const rpc = getConfiguredDirectIotaRpcUrl()
  const snap = getDirectMailboxChainSnapshot()
  if (!rpc || !snap) return null

  const mailboxObjectIds = collectMailboxIdsForHandshakeScan()

  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const hs = await findPeerHandshakeFromRpc(client, {
      packageId: snap.packageId.trim(),
      myAddress: snap.senderAddress.trim(),
      mailboxObjectIds,
      peerAddress: p,
    })
    if (!hs) {
      return { ok: true, found: false }
    }
    return {
      ok: true,
      found: true,
      sender: hs.sender,
      nonce: String(hs.nonce),
      peerPubRawBase64: uint8ToBase64(hs.pubKeyRaw),
    }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
