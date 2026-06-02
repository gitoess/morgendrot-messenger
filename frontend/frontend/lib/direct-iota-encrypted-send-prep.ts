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
} from '@/frontend/lib/direct-chat-ecdh-session'
import { canTryLiveEncryptedDirectMailbox } from '@/frontend/lib/direct-iota-encrypted-submit'
import { shouldSkipMessengerApiRelayFallback } from '@/frontend/lib/messenger-standalone-relay'

export { shouldSkipMessengerApiRelayFallback }

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

/** Vorbereitung vor verschlüsseltem Live-Send (Composer). */
export async function prepareEncryptedDirectMailboxSend(
  recipientTrimmed: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!getDirectChatEcdhPrivateKey()) {
    return {
      ok: false,
      error:
        'Chat-ECDH-Privatkey fehlt — in Puls JWK anwenden (gleicher Schlüssel wie Vault/Handshake auf dem Server).',
    }
  }
  const peer = await ensureDirectChatPeerPubForRecipient(recipientTrimmed)
  if (!peer.ok) return peer
  if (!canTryLiveEncryptedDirectMailbox(recipientTrimmed)) {
    return {
      ok: false,
      error:
        'Direkt-verschlüsselt nicht bereit — Direkt-RPC, Drain, Ketten-IDs und optimistische Flags prüfen (Puls / Autarkie).',
    }
  }
  if (!getDirectChatEcdhMaterialForRecipient(recipientTrimmed)) {
    return { ok: false, error: 'ECDH-Material für Empfänger fehlt nach Peer-Sync.' }
  }
  return { ok: true }
}
