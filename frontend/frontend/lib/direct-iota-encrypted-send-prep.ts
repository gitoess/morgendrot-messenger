'use client'

/**
 * § H.15 B.3 — verschlüsselter Direkt-Send ohne Relay: Peer-Pub von Chain, ECDH-Material.
 */
import { findPeerHandshake } from '@/frontend/lib/api/package-connect'
import {
  getDirectChatEcdhMaterialForRecipient,
  getDirectChatEcdhPrivateKey,
  hasDirectChatEcdhPeerPubForRecipient,
  setDirectChatEcdhPeerPubBase64,
  ensureSelfForensicEcdhMaterial,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { canTryLiveEncryptedDirect } from '@/frontend/lib/direct-iota-encrypted-submit'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import { tryAutoRestoreDirectChatEcdhPrivateKey } from '@/frontend/lib/direct-iota-vault-unlock-sync'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { normalizeRecipient0x } from '@/frontend/lib/encrypted-recipient-handshake-status'

const ECDH_MISSING =
  'Chat-ECDH-Privatkey fehlt — Tresor entsperren (wird automatisch aus Vault geladen) oder in Puls JWK anwenden.'

const NOT_READY: Record<'event' | 'mailbox', string> = {
  mailbox:
    'Direkt-verschlüsselt nicht bereit — Direkt-RPC, Drain, Ketten-IDs und optimistische Flags prüfen (Puls / Autarkie).',
  event:
    'Direkt-verschlüsselt (Event) nicht bereit — Direkt-RPC, Drain, Session-Signer, Package/Absender und ECDH prüfen.',
}

/** Peer-Pub von Fullnode holen und lokal speichern (ohne /api/find-peer-handshake). */
export async function ensureDirectChatPeerPubForRecipient(
  recipientTrimmed: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = recipientTrimmed.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(r)) {
    return { ok: false, error: 'Empfänger: gültige 0x-Adresse (64 Hex).' }
  }
  if (hasDirectChatEcdhPeerPubForRecipient(r)) return { ok: true }

  try {
    const hs = await findPeerHandshake(r)
    if (hs.ok && hs.found && hs.peerPubRawBase64) {
      const saved = setDirectChatEcdhPeerPubBase64(r, hs.peerPubRawBase64)
      if (!saved.ok) return saved
      return { ok: true }
    }
    return {
      ok: false,
      error:
        'Kein Handshake auf der Chain für diesen Partner — zuerst Handshake senden oder „Connect“ (Direkt-RPC).',
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Vorbereitung vor verschlüsseltem Live-Send (Composer, Event oder Mailbox). */
export async function prepareEncryptedDirectSend(
  recipientTrimmed: string,
  mode: MessagingPersistenceMode
): Promise<{ ok: true } | { ok: false; error: string }> {
  await tryAutoRestoreDirectChatEcdhPrivateKey()
  if (!getDirectChatEcdhPrivateKey()) {
    return { ok: false, error: ECDH_MISSING }
  }
  const myAddr = normalizeRecipient0x(getDirectIotaSessionSignerAddress() ?? '')
  const recipientNorm = normalizeRecipient0x(recipientTrimmed)
  if (myAddr && recipientNorm === myAddr) {
    const self = await ensureSelfForensicEcdhMaterial(recipientTrimmed)
    if (!self.ok) return self
  } else {
    const peer = await ensureDirectChatPeerPubForRecipient(recipientTrimmed)
    if (!peer.ok) return peer
  }
  const persistMode = mode === 'mailbox' ? 'mailbox' : 'event'
  if (!canTryLiveEncryptedDirect(recipientTrimmed, persistMode)) {
    return { ok: false, error: NOT_READY[persistMode] }
  }
  if (!getDirectChatEcdhMaterialForRecipient(recipientTrimmed)) {
    return { ok: false, error: 'ECDH-Material für Empfänger fehlt nach Peer-Sync.' }
  }
  return { ok: true }
}

/** @deprecated Alias — nutze `prepareEncryptedDirectSend(..., 'mailbox')`. */
export const prepareEncryptedDirectMailboxSend = (recipient: string) =>
  prepareEncryptedDirectSend(recipient, 'mailbox')

/** @deprecated Alias — nutze `prepareEncryptedDirectSend(..., 'event')`. */
export const prepareEncryptedDirectEventSend = (recipient: string) =>
  prepareEncryptedDirectSend(recipient, 'event')
