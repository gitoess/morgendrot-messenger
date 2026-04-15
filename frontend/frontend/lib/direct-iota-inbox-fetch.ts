'use client'

/**
 * §6.B.4: Mailbox-Posteingang per Fullnode (Klartext und/oder verschlüsselt, Entschlüsselung im Browser).
 * Merge mit `/inbox` steuert **`use-chat-view-inbox`** (RPC vor API).
 */

import {
  createDirectIotaClient,
  fetchMailboxInboxRpcRows,
  normalizeMailboxAddress,
} from '@morgendrot/core/iota'
import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { uint8ToBase64 } from '@morgendrot/shared/bytes-base64'
import { deriveAesGcmKey, deriveSharedSecret, decryptMessage } from '@morgendrot/shared/morgendrot-crypto'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  canUseDirectEncryptedMailboxDrain,
  canUseDirectPlaintextMailboxDrain,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { getDirectChatEcdhMaterialForRecipient } from '@/frontend/lib/direct-chat-ecdh-session'
import { isDirectMailboxDrainEnabled, isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'

export type TryFetchDirectMailboxInboxViaIotaOpts = {
  limit: number
  offset: number
  /** Wenn gesetzt und von API übergeben: muss mit Snapshot-Package übereinstimmen (sonst Abbruch). */
  packageIdOverride?: string
}

export async function tryFetchDirectMailboxInboxViaIota(
  opts: TryFetchDirectMailboxInboxViaIotaOpts
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
  const includePlain = canUseDirectPlaintextMailboxDrain()
  const includeEnc = canUseDirectEncryptedMailboxDrain() && isDirectMailboxDrainEnabled()
  if (!includePlain && !includeEnc) {
    return {
      ok: false,
      error:
        'Konfiguration: direkter Posteingang nur mit aktiver Mailbox ohne Messenger-Credits (Klartext-Flags oder verschlüsselt mit Direkt-Mailbox-Drain an).',
    }
  }
  const pkg = snap.packageId.trim()
  if (opts.packageIdOverride?.trim() && opts.packageIdOverride.trim().toLowerCase() !== pkg.toLowerCase()) {
    return { ok: false, error: 'Package-ID weicht vom gespeicherten Snapshot ab — Posteingang per API laden.' }
  }
  const my = snap.senderAddress.trim()
  const myNorm = normalizeMailboxAddress(my)

  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const rpcRows = await fetchMailboxInboxRpcRows(client, {
      mailboxObjectId: snap.mailboxId,
      packageId: pkg,
      myAddress: my,
      includePlaintext: includePlain,
      includeEncrypted: includeEnc,
      limit: opts.limit,
      offset: opts.offset,
    })

    const apiRows: InboxApiRow[] = []
    for (const r of rpcRows) {
      if (r.kind === 'plain') {
        apiRows.push({
          sender: r.sender,
          recipient: r.recipient,
          text: r.text,
          isPlain: true,
          nonce: r.nonce,
          ts: r.ts,
          chainPurgeable: true,
        })
        continue
      }
      const peerAddr = normalizeMailboxAddress(r.sender) === myNorm ? r.recipient : r.sender
      const mat = getDirectChatEcdhMaterialForRecipient(peerAddr)
      if (!mat) {
        apiRows.push({
          sender: r.sender,
          recipient: r.recipient,
          text: `[Verschlüsselt] Kein Chat-ECDH für ${String(peerAddr).slice(0, 14)}… — Peer-Pub in den Puls-Einstellungen setzen.`,
          isPlain: false,
          nonce: r.nonce,
          ts: r.ts,
          chainPurgeable: true,
        })
        continue
      }
      try {
        const sharedSecret = await deriveSharedSecret(mat.ecdhPrivateKey, mat.peerPubRaw)
        const aesKey = await deriveAesGcmKey(sharedSecret)
        const ivB64 = uint8ToBase64(r.iv)
        const combined = new Uint8Array([...r.ciphertext, ...r.tag])
        const combinedB64 = uint8ToBase64(combined)
        const text = await decryptMessage(aesKey, ivB64, combinedB64)
        apiRows.push({
          sender: r.sender,
          recipient: r.recipient,
          text,
          isPlain: false,
          nonce: r.nonce,
          ts: r.ts,
          chainPurgeable: true,
        })
      } catch {
        apiRows.push({
          sender: r.sender,
          recipient: r.recipient,
          text: '[Verschlüsselt] Entschlüsselung fehlgeschlagen (Key passt nicht oder Nutzlast beschädigt).',
          isPlain: false,
          nonce: r.nonce,
          ts: r.ts,
          chainPurgeable: true,
        })
      }
    }
    return { ok: true, rows: apiRows }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
