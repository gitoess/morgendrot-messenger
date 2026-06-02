'use client'

/**
 * § H.15 B.2: Connect ohne `/connect`-API — Handshake per RPC lesen, Peer-Pub lokal, optional Gegen-Handshake.
 */

import {
  createDirectIotaClient,
  findPeerHandshakeFromRpc,
  listIncomingHandshakeOffersRpc,
} from '@morgendrot/core/iota'
import { uint8ToBase64 } from '@morgendrot/shared/bytes-base64'
import { addConnectedPeerToLocalSnapshot } from '@/frontend/lib/connected-peers-snapshot'
import { setDirectChatEcdhPeerPubBase64 } from '@/frontend/lib/direct-chat-ecdh-session'
import { getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { canFetchHandshakesViaDirectIota } from '@/frontend/lib/direct-iota-handshake-fetch'
import { readClientMailboxIdsForHandshakeScan } from '@/frontend/lib/pending-handshake-mailbox-ids'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  canTryDirectHandshakeSubmit,
  trySubmitHandshakeViaDirectIota,
} from '@/frontend/lib/direct-iota-handshake-submit'

const POLL_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}

function collectMailboxIdsForScan(): string[] {
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

export function canTryDirectConnectPeer(): boolean {
  return canFetchHandshakesViaDirectIota()
}

type IncomingHs = {
  sender: string
  pubKeyRaw: Uint8Array
  source: 'mailbox' | 'event'
}

async function findIncomingFromPartnerRpc(
  partner: string,
  pollAttempts: number
): Promise<IncomingHs | { error: string }> {
  if (!canFetchHandshakesViaDirectIota()) {
    return { error: 'Direkt-RPC oder Ketten-Snapshot fehlt.' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  const snap = getDirectMailboxChainSnapshot()
  if (!rpc || !snap) return { error: 'RPC oder Snapshot fehlt.' }

  const mailboxObjectIds = collectMailboxIdsForScan()
  if (mailboxObjectIds.length === 0) {
    return { error: 'Keine Mailbox-IDs für Handshake-Scan.' }
  }

  const client = createDirectIotaClient({ rpcUrl: rpc })
  const base = {
    packageId: snap.packageId.trim(),
    myAddress: snap.senderAddress.trim(),
    mailboxObjectIds,
  }

  const attempts = Math.min(12, Math.max(1, pollAttempts))
  try {
    for (let i = 0; i < attempts; i++) {
      const hs = await findPeerHandshakeFromRpc(client, { ...base, peerAddress: partner })
      if (hs) {
        return { sender: hs.sender, pubKeyRaw: hs.pubKeyRaw, source: hs.source }
      }
      if (i < attempts - 1) await sleep(POLL_MS)
    }
    return {
      error: `Kein Handshake von ${partner.slice(0, 10)}… in Mailbox/Events — Partner muss zuerst Handshake senden.`,
    }
  } catch (e) {
    return { error: formatDirectIotaSubmitError(e) }
  }
}

async function applyIncomingHandshake(hs: IncomingHs): Promise<{ ok: true } | { ok: false; error: string }> {
  const peerAddr = hs.sender.trim()
  const saved = setDirectChatEcdhPeerPubBase64(peerAddr, uint8ToBase64(hs.pubKeyRaw))
  if (!saved.ok) return saved
  addConnectedPeerToLocalSnapshot(peerAddr)
  return { ok: true }
}

/** Ersten eingehenden Handshake (höchste Nonce aus Angebotsliste). */
export async function tryConnectAcceptFirstIncomingViaDirectIota(opts?: {
  pollAttempts?: number
}): Promise<
  | { ok: true; peerAddress: string; replySent: boolean; source: 'mailbox' | 'event' }
  | { ok: false; error: string }
> {
  if (!canFetchHandshakesViaDirectIota()) {
    return { ok: false, error: 'Direkt-RPC oder Ketten-Snapshot fehlt.' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  const snap = getDirectMailboxChainSnapshot()
  if (!rpc || !snap) return { ok: false, error: 'RPC oder Snapshot fehlt.' }

  const mailboxObjectIds = collectMailboxIdsForScan()
  const client = createDirectIotaClient({ rpcUrl: rpc })
  const attempts = Math.min(12, Math.max(1, opts?.pollAttempts ?? 8))

  try {
    for (let i = 0; i < attempts; i++) {
      const offers = await listIncomingHandshakeOffersRpc(client, {
        packageId: snap.packageId.trim(),
        myAddress: snap.senderAddress.trim(),
        mailboxObjectIds,
        limit: 5,
      })
      if (offers.length > 0) {
        return tryConnectPeerViaDirectIota(offers[0]!.sender, { pollAttempts: 1, replyHandshake: true })
      }
      if (i < attempts - 1) await sleep(POLL_MS)
    }
    return { ok: false, error: 'Kein eingehender Handshake in Mailbox/Events gefunden.' }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

/** Partner-Connect: Peer-Pub aus Chain → localStorage; optional Antwort-Handshake per Direkt-RPC. */
export async function tryConnectPeerViaDirectIota(
  partner: string,
  opts?: { pollAttempts?: number; replyHandshake?: boolean }
): Promise<
  | { ok: true; peerAddress: string; replySent: boolean; source: 'mailbox' | 'event' }
  | { ok: false; error: string }
> {
  const partnerTrim = partner.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(partnerTrim)) {
    return { ok: false, error: 'Partner: 0x + 64 Hex.' }
  }

  const found = await findIncomingFromPartnerRpc(partnerTrim, opts?.pollAttempts ?? 4)
  if ('error' in found) return { ok: false, error: found.error }

  const applied = await applyIncomingHandshake(found)
  if (!applied.ok) return applied

  let replySent = false
  if (opts?.replyHandshake !== false && canTryDirectHandshakeSubmit()) {
    const reply = await trySubmitHandshakeViaDirectIota({ recipient: found.sender.trim() })
    replySent = reply.ok
  }

  return { ok: true, peerAddress: found.sender.trim(), replySent, source: found.source }
}
