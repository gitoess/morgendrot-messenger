'use client'

/**
 * Diskret-Empfang: Lookahead über ECDH-Peers → Stealth-Buckets → Entschlüsselung.
 * Nur wenn Opt-in Diskret an (gleiche Pref wie Senden).
 */
import type { IotaClient } from '@iota/iota-sdk/client'
import { fetchStealthBucketsForSlotTags } from '@morgendrot/core/iota'
import { deriveSharedSecret } from '@morgendrot/shared/morgendrot-crypto'
import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import {
  getDirectChatEcdhMaterialForRecipient,
  listDirectChatEcdhPeerRecipientAddresses,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { decryptDirectInboxEncryptedPayload } from '@/frontend/lib/direct-iota-inbox-decrypt'
import { readDiskretSendEnabled } from '@/frontend/lib/diskret-send-pref'
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
 * Für alle gespeicherten ECDH-Peers: Epoch±W abfragen, Ciphertexte entschlüsseln.
 * Fehler pro Peer/Entry werden übersprungen (kein harter Fail).
 */
export async function fetchStealthLookaheadInboxRows(opts: {
  client: IotaClient
  mailboxObjectId: string
  myAddress: string
  windowW?: number
}): Promise<StealthLookaheadSortable[]> {
  if (!readDiskretSendEnabled()) return []

  const peers = listDirectChatEcdhPeerRecipientAddresses()
  if (peers.length === 0) return []

  const callPackageId = getStealthCallPackageId()
  const my = opts.myAddress.trim().toLowerCase()
  const out: StealthLookaheadSortable[] = []
  const seenKeys = new Set<string>()

  for (const peer of peers) {
    const mat = getDirectChatEcdhMaterialForRecipient(peer)
    if (!mat) continue
    let shared: Uint8Array
    try {
      shared = await deriveSharedSecret(mat.ecdhPrivateKey, mat.peerPubRaw)
    } catch {
      continue
    }
    const tags = deriveStealthLookaheadSlotTags(shared, {
      windowW: opts.windowW ?? STEALTH_LOOKAHEAD_WINDOW_DEFAULT,
    })
    let buckets
    try {
      buckets = await fetchStealthBucketsForSlotTags(opts.client, {
        mailboxObjectId: opts.mailboxObjectId,
        callPackageId,
        slotTags: tags,
      })
    } catch {
      continue
    }

    for (const bucket of buckets) {
      const tagHex = stealthSlotTagToHex(bucket.slotTag)
      for (const entry of bucket.entries) {
        const inboxKey = stealthInboxKey(tagHex, entry.entryId)
        if (seenKeys.has(inboxKey)) continue
        seenKeys.add(inboxKey)

        const dec = await decryptDirectInboxEncryptedPayload(
          peer,
          { iv: entry.iv, ciphertext: entry.ciphertext, tag: entry.aesTag },
          { sender: peer, recipient: my }
        )
        if (!dec.ok) continue

        const ts =
          entry.createdAtMs > 1_000_000_000_000
            ? entry.createdAtMs
            : entry.createdAtMs > 0
              ? entry.createdAtMs * 1000
              : Date.now()
        out.push({
          sortTs: ts,
          row: {
            sender: peer,
            recipient: my,
            text: dec.text,
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
  }

  return out
}
