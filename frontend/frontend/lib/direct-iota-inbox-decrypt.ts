'use client'

import { decryptIotaPeerSessionMessage } from '@morgendrot/shared/morgendrot-crypto-session-wire'
import {
  getDirectChatEcdhMaterialForRecipient,
  getDirectChatEcdhPrivateKey,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { getDirectChainFieldIdsFromLs, getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import { ensureDirectChatPeerPubForRecipient } from '@/frontend/lib/direct-iota-encrypted-send-prep'

export type EncryptedInboxPayload = {
  iv: Uint8Array
  ciphertext: Uint8Array
  tag: Uint8Array
}

export async function decryptDirectInboxEncryptedPayload(
  peerAddr: string,
  payload: EncryptedInboxPayload
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  let mat = getDirectChatEcdhMaterialForRecipient(peerAddr)
  if (!mat && getDirectChatEcdhPrivateKey()) {
    await ensureDirectChatPeerPubForRecipient(peerAddr)
    mat = getDirectChatEcdhMaterialForRecipient(peerAddr)
  }
  if (!mat) {
    return {
      ok: false,
      error: `[Verschlüsselt] Kein Chat-ECDH für ${String(peerAddr).slice(0, 14)}… — Peer-Pub in den Puls-Einstellungen setzen.`,
    }
  }
  const snap = getDirectMailboxChainSnapshot()
  const myAddress = (snap?.senderAddress ?? getDirectChainFieldIdsFromLs().senderAddress).trim()
  if (!myAddress) {
    return {
      ok: false,
      error: '[Verschlüsselt] MY_ADDRESS unbekannt — Status aktualisieren.',
    }
  }
  try {
    const text = await decryptIotaPeerSessionMessage({
      iv: payload.iv,
      ciphertext: payload.ciphertext,
      tag: payload.tag,
      myAddress,
      peerAddress: peerAddr.trim(),
      myPrivKey: mat.ecdhPrivateKey,
      peerPubRaw: mat.peerPubRaw,
    })
    return { ok: true, text }
  } catch {
    return { ok: false, error: '[Verschlüsselt] Entschlüsselung fehlgeschlagen.' }
  }
}
