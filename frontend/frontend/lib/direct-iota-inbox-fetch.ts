'use client'

/**
 * §6.B.4 (Stufe 1): Klartext-Mailbox-Posteingang per Fullnode — ohne `/api` `/inbox`.
 * Verschlüsselte Einträge folgen später (ECDH + gleiche Leselogik wie Node).
 */

import { createDirectIotaClient, fetchPlaintextMailboxInboxRows } from '@morgendrot/core/iota'
import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { canUseDirectPlaintextMailboxDrain, getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import { isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'

export type TryFetchPlaintextInboxViaDirectIotaOpts = {
  limit: number
  offset: number
  /** Wenn gesetzt und von API übergeben: muss mit Snapshot-Package übereinstimmen (sonst Abbruch). */
  packageIdOverride?: string
}

export async function tryFetchPlaintextInboxViaDirectIota(
  opts: TryFetchPlaintextInboxViaDirectIotaOpts
): Promise<{ ok: true; rows: InboxApiRow[] } | { ok: false; error: string }> {
  if (isIotaRelayOnlyMode()) {
    return { ok: false, error: 'Modus „Nur Morgendrot-API“: direkter Posteingang per Fullnode ist aus.' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) {
    return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  }
  const snap = getDirectMailboxChainSnapshot()
  if (!snap) {
    return { ok: false, error: 'Keine Ketten-IDs (Snapshot).' }
  }
  if (!canUseDirectPlaintextMailboxDrain()) {
    return {
      ok: false,
      error: 'Konfiguration: direkter Klartext-Posteingang nur mit Mailbox-Klartext ohne Messenger-Credits (wie Direkt-Senden).',
    }
  }
  const pkg = snap.packageId.trim()
  if (opts.packageIdOverride?.trim() && opts.packageIdOverride.trim().toLowerCase() !== pkg.toLowerCase()) {
    return { ok: false, error: 'Package-ID weicht vom gespeicherten Snapshot ab — Posteingang per API laden.' }
  }
  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const rows = await fetchPlaintextMailboxInboxRows(client, {
      mailboxObjectId: snap.mailboxId,
      packageId: pkg,
      myAddress: snap.senderAddress.trim(),
      limit: opts.limit,
      offset: opts.offset,
    })
    const apiRows: InboxApiRow[] = rows.map((r) => ({
      sender: r.sender,
      recipient: r.recipient,
      text: r.text,
      isPlain: true,
      nonce: r.nonce,
      ts: r.ts,
      chainPurgeable: true,
    }))
    return { ok: true, rows: apiRows }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
