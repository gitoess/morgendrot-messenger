'use client'

/**
 * §6.B.4: Mailbox-Posteingang per Fullnode (Klartext und/oder verschlüsselt, Entschlüsselung im Browser).
 * Merge mit `/inbox` steuert **`use-chat-view-inbox`** (RPC vor API).
 */

import {
  chainMessageLogicalDedupKey,
  createDirectIotaClient,
  fetchMailboxInboxRpcRows,
  fetchMessagingEventInboxRpcRows,
  fetchTeamPlainBroadcastRpcRows,
  isLikelyIotaHexId,
  mailboxPlainInboxKey,
  normalizeMailboxAddress,
  type MessagingEventInboxRpcRow,
} from '@morgendrot/core/iota'
import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { uint8ToBase64 } from '@morgendrot/shared/bytes-base64'
import { deriveAesGcmKey, deriveSharedSecret, decryptMessage } from '@morgendrot/shared/morgendrot-crypto'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  canUseDirectEncryptedMailboxDrain,
  canUseDirectPlaintextMailboxDrain,
  getDirectChainIdsReadiness,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { isStandaloneDeviceMode } from '@/frontend/lib/capacitor-standalone-bootstrap'
import {
  getDirectChatEcdhMaterialForRecipient,
  getDirectChatEcdhPrivateKey,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { ensureDirectChatPeerPubForRecipient } from '@/frontend/lib/direct-iota-encrypted-send-prep'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'

export type TryFetchDirectMailboxInboxViaIotaOpts = {
  limit: number
  offset: number
  /** Wenn gesetzt und von API übergeben: muss mit Snapshot-Package übereinstimmen (sonst Abbruch). */
  packageIdOverride?: string
  /** M4b: private Kontakt-Mailbox statt Snapshot-Shared-Mailbox. */
  mailboxObjectId?: string
  /** Move-Events (EncryptedMessage/PlaintextMessage) — nur Shared-Posteingang-Union. */
  includeMessagingEvents?: boolean
}

function shouldIncludeMessagingEventsInDirectInbox(
  mailboxObjectId: string,
  sharedMailboxId: string
): boolean {
  const mb = mailboxObjectId.trim().toLowerCase()
  const shared = sharedMailboxId.trim().toLowerCase()
  return mb === shared
}

function inboxTsFromRow(tsMs: number, nonce: bigint): number {
  if (tsMs > 0) return tsMs
  const n = Number(nonce)
  return Number.isFinite(n) && n >= 1_000_000_000_000 ? n : 0
}

function mergeSortPageInboxRows(rows: InboxApiRow[], limit: number, offset: number): InboxApiRow[] {
  rows.sort((a, b) => {
    const ta = inboxTsFromRow(Number(a.ts ?? 0), BigInt(String(a.nonce ?? 0)))
    const tb = inboxTsFromRow(Number(b.ts ?? 0), BigInt(String(b.nonce ?? 0)))
    return tb - ta
  })
  return rows.slice(offset, offset + limit)
}

async function mapEventRowsToInboxApi(
  eventRows: MessagingEventInboxRpcRow[],
  myNorm: string
): Promise<InboxApiRow[]> {
  const apiRows: InboxApiRow[] = []
  for (const r of eventRows) {
    if (r.kind === 'plain') {
      apiRows.push({
        sender: r.sender,
        recipient: r.recipient,
        text: r.text,
        isPlain: true,
        nonce: String(r.nonce),
        ts: r.tsMs,
        chainPurgeable: false,
        inboxKey: r.inboxKey,
      })
      continue
    }
    const peerAddr = normalizeMailboxAddress(r.sender) === myNorm ? r.recipient : r.sender
    let mat = getDirectChatEcdhMaterialForRecipient(peerAddr)
    if (!mat && getDirectChatEcdhPrivateKey()) {
      await ensureDirectChatPeerPubForRecipient(peerAddr)
      mat = getDirectChatEcdhMaterialForRecipient(peerAddr)
    }
    if (!mat) {
      apiRows.push({
        sender: r.sender,
        recipient: r.recipient,
        text: `[Verschlüsselt] Kein Chat-ECDH für ${String(peerAddr).slice(0, 14)}… — Peer-Pub in den Puls-Einstellungen setzen.`,
        isPlain: false,
        nonce: String(r.nonce),
        ts: r.tsMs,
        chainPurgeable: false,
        inboxKey: r.inboxKey,
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
        nonce: String(r.nonce),
        ts: r.tsMs,
        chainPurgeable: false,
        inboxKey: r.inboxKey,
      })
    } catch {
      apiRows.push({
        sender: r.sender,
        recipient: r.recipient,
        text: '[Verschlüsselt] Entschlüsselung fehlgeschlagen (Event).',
        isPlain: false,
        nonce: String(r.nonce),
        ts: r.tsMs,
        chainPurgeable: false,
        inboxKey: r.inboxKey,
      })
    }
  }
  return apiRows
}

function canIncludePlaintextInDirectInbox(): boolean {
  if (canUseDirectPlaintextMailboxDrain()) return true
  return isStandaloneDeviceMode() && Boolean(getDirectMailboxChainSnapshot())
}

/** Lesen/Entschlüsseln auch ohne Drain-Flags, wenn Standalone + Chat-ECDH lokal. */
function canIncludeEncryptedInDirectInbox(): boolean {
  if (canUseDirectEncryptedMailboxDrain()) return true
  return (
    isStandaloneDeviceMode() &&
    Boolean(getDirectMailboxChainSnapshot()) &&
    Boolean(getDirectChatEcdhPrivateKey())
  )
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
    const { missing } = getDirectChainIdsReadiness()
    return {
      ok: false,
      error:
        missing.length > 0
          ? `Ketten-IDs für Direkt-Posteingang unvollständig: ${missing.join(', ')}.`
          : 'Keine Ketten-IDs (Snapshot).',
    }
  }
  const includePlain = canIncludePlaintextInDirectInbox()
  const includeEnc = canIncludeEncryptedInDirectInbox()
  const includeTeamBroadcast = Boolean(snap?.flags.useMailbox)
  if (!includePlain && !includeEnc && !includeTeamBroadcast) {
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
  const mailboxObjectId = (opts.mailboxObjectId?.trim() || snap.mailboxId).trim()
  if (!isLikelyIotaHexId(mailboxObjectId)) {
    return { ok: false, error: 'Ungültige Mailbox-ID für Direkt-Posteingang.' }
  }
  const my = snap.senderAddress.trim()
  const myNorm = normalizeMailboxAddress(my)

  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const fetchWindow = opts.limit + opts.offset
    const rpcRows = await fetchMailboxInboxRpcRows(client, {
      mailboxObjectId,
      packageId: pkg,
      myAddress: my,
      includePlaintext: includePlain,
      includeEncrypted: includeEnc,
      limit: fetchWindow,
      offset: 0,
    })

    let apiRows: InboxApiRow[] = []
    for (const r of rpcRows) {
      if (r.kind === 'plain') {
        const ts = r.ts ?? 0
        apiRows.push({
          sender: r.sender,
          recipient: r.recipient,
          text: r.text,
          isPlain: true,
          nonce: r.nonce,
          ts,
          chainPurgeable: true,
          inboxKey: mailboxPlainInboxKey({
            sender: r.sender,
            recipient: r.recipient,
            nonce: r.nonce,
            tsMs: ts,
          }),
        })
        continue
      }
      const peerAddr = normalizeMailboxAddress(r.sender) === myNorm ? r.recipient : r.sender
      let mat = getDirectChatEcdhMaterialForRecipient(peerAddr)
      if (!mat && getDirectChatEcdhPrivateKey()) {
        await ensureDirectChatPeerPubForRecipient(peerAddr)
        mat = getDirectChatEcdhMaterialForRecipient(peerAddr)
      }
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

    if (includeTeamBroadcast) {
      const teamRows = await fetchTeamPlainBroadcastRpcRows(client, {
        teamMailboxObjectId: mailboxObjectId,
        packageId: pkg,
        limit: fetchWindow,
        offset: 0,
      })
      for (const r of teamRows) {
        apiRows.push({
          sender: r.sender,
          recipient: r.teamMailboxObjectId,
          text: r.text,
          isPlain: true,
          nonce: r.nonce,
          ts: r.ts,
          chainPurgeable: true,
          chainPurgeKind: 'team-broadcast',
          inboxKey: `team:${r.teamMailboxObjectId}:${r.sender}:${r.nonce}`,
        })
      }
    }

    const mailboxLogicalKeys = new Set<string>()
    for (const row of apiRows) {
      if (row.chainPurgeable !== false) {
        const lk = chainMessageLogicalDedupKey({
          sender: row.sender ?? '',
          recipient: row.recipient,
          nonce: row.nonce ?? '',
        })
        if (lk) mailboxLogicalKeys.add(lk)
      }
    }

    const includeEvents =
      opts.includeMessagingEvents !== false &&
      shouldIncludeMessagingEventsInDirectInbox(mailboxObjectId, snap.mailboxId)
    if (includeEvents) {
      const eventRows = await fetchMessagingEventInboxRpcRows(client, {
        packageId: pkg,
        myAddress: my,
        limit: fetchWindow,
        offset: 0,
      })
      const eventApiRows = await mapEventRowsToInboxApi(eventRows, myNorm)
      for (const row of eventApiRows) {
        const lk = chainMessageLogicalDedupKey({
          sender: row.sender ?? '',
          recipient: row.recipient,
          nonce: row.nonce ?? '',
        })
        if (lk && mailboxLogicalKeys.has(lk)) continue
        apiRows.push(row)
      }
    }

    apiRows = mergeSortPageInboxRows(apiRows, opts.limit, opts.offset)
    return { ok: true, rows: apiRows }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
