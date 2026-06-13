'use client'

import type { Signer } from '@iota/iota-sdk/cryptography'
import { createDirectIotaClient } from '@morgendrot/core/iota'
import { syncActiveNetworkChainSnapshot } from '@/frontend/lib/active-network-chain-sync'
import {
  getDirectMailboxChainSnapshot,
  type DirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  getDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { directIotaSignerMatchesIdentity } from '@/frontend/lib/direct-iota-signer-identity'
import { trimValidIotaAddress } from '@/frontend/lib/iota-address'
import { isDirectMailboxDrainEnabled, isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'

export type DirectIotaSubmitContext =
  | {
      ok: true
      rpc: string
      signer: Signer
      signerAddr: string
      snap: DirectMailboxChainSnapshot
      client: ReturnType<typeof createDirectIotaClient>
      recipient?: string
    }
  | { ok: false; error: string }

/** Gemeinsame Voraussetzungen für Direct-Send/Purge/Handshake im Browser. */
export function resolveDirectIotaSubmitContext(opts?: {
  relayBlockedMessage?: string
  requireRecipient?: string
  skipDrainCheck?: boolean
}): DirectIotaSubmitContext {
  const relayMsg =
    opts?.relayBlockedMessage ??
    'Modus „Nur Morgendrot-API“: direkter Fullnode-Zugriff ist aus — in den Puls-Einstellungen auf „Direkt“ stellen.'
  if (isIotaRelayOnlyMode()) return { ok: false, error: relayMsg }
  if (!opts?.skipDrainCheck && !isDirectMailboxDrainEnabled()) {
    return { ok: false, error: 'Direkt-Mailbox-Drain ist aus.' }
  }
  syncActiveNetworkChainSnapshot()
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  const signer = getDirectIotaSessionSigner()
  const signerAddr = getDirectIotaSessionSignerAddress()
  if (!signer || !signerAddr) {
    return { ok: false, error: 'Kein Session-Signer — Tresor entsperren oder Mnemonic setzen.' }
  }
  const snap = getDirectMailboxChainSnapshot()
  if (!snap) return { ok: false, error: 'Keine Ketten-IDs (Package/Mailbox/Absender).' }
  if (!directIotaSignerMatchesIdentity(signerAddr, snap.senderAddress)) {
    return { ok: false, error: 'Signer-Adresse ≠ gespeicherter Absender.' }
  }
  let recipient: string | undefined
  if (opts?.requireRecipient != null) {
    recipient = trimValidIotaAddress(opts.requireRecipient) ?? undefined
    if (!recipient) return { ok: false, error: 'Empfänger: gültige 0x-Adresse (64 Hex).' }
  }
  return {
    ok: true,
    rpc,
    signer,
    signerAddr,
    snap,
    client: createDirectIotaClient({ rpcUrl: rpc }),
    recipient,
  }
}
