'use client'

/**
 * Diskret-Empfang: Stealth-Buckets aus Haupt-Mailbox → Entschlüsselung mit ECDH-Peers.
 * Empfang braucht **keinen** Diskret-Send-Toggle (nur Peer-ECDH). Senden bleibt Opt-in.
 */
import type { IotaClient } from '@iota/iota-sdk/client'
import {
  fetchStealthStoredEventTimestamps,
  scanStealthBucketsFromMailbox,
  stealthStoredEventMapKey,
} from '@morgendrot/core/iota'
import { deriveSharedSecret } from '@morgendrot/shared/morgendrot-crypto'
import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import {
  getDirectChatEcdhMaterialForRecipient,
  listDirectChatEcdhPeerRecipientAddresses,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { decryptDirectInboxEncryptedPayload } from '@/frontend/lib/direct-iota-inbox-decrypt'
import { getStealthCallPackageId } from '@/frontend/lib/stealth-call-package'
import {
  deriveStealthLookaheadSlotTags,
  stealthInboxKey,
  STEALTH_LOOKAHEAD_WINDOW_DEFAULT,
} from '@/frontend/lib/stealth-lookahead'
import { stealthSlotTagToHex } from '@/frontend/lib/stealth-slot-tag'

export type StealthLookaheadSortable = {
  sortTs: number
  row: InboxApiRow
}

/**
 * Alle Stealth-Buckets scannen (Call-Package), Ciphertexte mit bekannten Peers entschlüsseln.
 * Tag-Lookahead filtert zuerst; ohne Treffer trotzdem voller Stealth-Scan (Clock/Encoding).
 */
export async function fetchStealthLookaheadInboxRows(opts: {
  client: IotaClient
  mailboxObjectId: string
  myAddress: string
  windowW?: number
}): Promise<StealthLookaheadSortable[]> {
  const peers = listDirectChatEcdhPeerRecipientAddresses()
  if (peers.length === 0) return []

  const callPackageId = getStealthCallPackageId()
  const my = opts.myAddress.trim().toLowerCase()
  const windowW = opts.windowW ?? STEALTH_LOOKAHEAD_WINDOW_DEFAULT

  const preferredTagHex = new Set<string>()
  const peerBySharedReady: string[] = []
  for (const peer of peers) {
    const mat = getDirectChatEcdhMaterialForRecipient(peer)
    if (!mat) continue
    peerBySharedReady.push(peer)
    try {
      const shared = await deriveSharedSecret(mat.ecdhPrivateKey, mat.peerPubRaw)
      for (const tag of deriveStealthLookaheadSlotTags(shared, { windowW })) {
        preferredTagHex.add(stealthSlotTagToHex(tag))
      }
    } catch {
      /* Peer trotzdem für Decrypt behalten */
    }
  }
  if (peerBySharedReady.length === 0) return []

  let buckets
  try {
    /** Erst bevorzugte Tags; wenn leer → alle Stealth-DFs (andere Epoche / Lookup-Miss). */
    buckets = await scanStealthBucketsFromMailbox(opts.client, {
      mailboxObjectId: opts.mailboxObjectId,
      callPackageId,
      onlySlotTagHex: preferredTagHex.size > 0 ? preferredTagHex : undefined,
    })
    if (buckets.length === 0 && preferredTagHex.size > 0) {
      buckets = await scanStealthBucketsFromMailbox(opts.client, {
        mailboxObjectId: opts.mailboxObjectId,
        callPackageId,
      })
    }
  } catch {
    return []
  }

  /** Event-Zeit schlägt klebende Move-`created_at_ms` (Visitenkarte-Sort-Bug). */
  let eventTs = new Map<string, number>()
  try {
    eventTs = await fetchStealthStoredEventTimestamps(opts.client, { callPackageId, limit: 120 })
  } catch {
    eventTs = new Map()
  }

  const out: StealthLookaheadSortable[] = []
  const seenKeys = new Set<string>()

  for (const bucket of buckets) {
    const tagHex = stealthSlotTagToHex(bucket.slotTag)
    for (const entry of bucket.entries) {
      const inboxKey = stealthInboxKey(tagHex, entry.entryId)
      if (seenKeys.has(inboxKey)) continue

      let decrypted: { sender: string; recipient: string; text: string } | null = null
      for (const peer of peerBySharedReady) {
        /** Eingehend: Peer → ich. */
        const decIn = await decryptDirectInboxEncryptedPayload(
          peer,
          { iv: entry.iv, ciphertext: entry.ciphertext, tag: entry.aesTag },
          { sender: peer, recipient: my }
        )
        if (decIn.ok) {
          decrypted = { sender: peer, recipient: my, text: decIn.text }
          break
        }
        /** Eigenes Echo: ich → Peer. */
        const decOut = await decryptDirectInboxEncryptedPayload(
          peer,
          { iv: entry.iv, ciphertext: entry.ciphertext, tag: entry.aesTag },
          { sender: my, recipient: peer }
        )
        if (decOut.ok) {
          decrypted = { sender: my, recipient: peer, text: decOut.text }
          break
        }
      }
      if (!decrypted) continue
      seenKeys.add(inboxKey)

      const fromEntry =
        entry.createdAtMs > 1_000_000_000_000
          ? entry.createdAtMs
          : entry.createdAtMs > 0
            ? entry.createdAtMs * 1000
            : 0
      const fromEvent = eventTs.get(stealthStoredEventMapKey(bucket.slotTag, entry.entryId)) ?? 0
      const ts = fromEvent > 0 ? fromEvent : fromEntry > 0 ? fromEntry : Date.now()

      out.push({
        sortTs: ts,
        row: {
          sender: decrypted.sender,
          recipient: decrypted.recipient,
          text: decrypted.text,
          isPlain: false,
          nonce: String(entry.entryId),
          ts,
          chainPurgeable: true,
          chainMailboxObjectId: opts.mailboxObjectId,
          inboxKey,
        },
      })
    }
  }

  return out
}
