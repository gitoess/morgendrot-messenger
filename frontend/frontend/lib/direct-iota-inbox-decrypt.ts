'use client'

import { decryptIotaPeerSessionMessage } from '@morgendrot/shared/morgendrot-crypto-session-wire'
import {
  getDirectChatEcdhMaterialForRecipient,
  getDirectChatEcdhPrivateKey,
  getDirectChatEcdhPeerPubBase64,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { base64ToUint8 } from '@morgendrot/shared/bytes-base64'
import {
  getPeerSessionArchiveForRecipient,
  mergeDirectSessionKeysFromPeerMap,
} from '@/frontend/lib/direct-session-keys-archive'
import { getDirectChainFieldIdsFromLs, getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import { ensureDirectChatPeerPubForRecipient } from '@/frontend/lib/direct-iota-encrypted-send-prep'

function ensurePeerSessionArchive(peerAddr: string): void {
  if (getPeerSessionArchiveForRecipient(peerAddr)) return
  const b64 = getDirectChatEcdhPeerPubBase64(peerAddr)
  if (!b64) return
  try {
    mergeDirectSessionKeysFromPeerMap([[peerAddr, { pubKeyRaw: base64ToUint8(b64) }]])
  } catch {
    /* ignore */
  }
}

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
    ensurePeerSessionArchive(peerAddr)
    const text = await decryptIotaPeerSessionMessage({
      iv: payload.iv,
      ciphertext: payload.ciphertext,
      tag: payload.tag,
      myAddress,
      peerAddress: peerAddr.trim(),
      myPrivKey: mat.ecdhPrivateKey,
      peerPubRaw: mat.peerPubRaw,
      sessionArchive: getPeerSessionArchiveForRecipient(peerAddr),
    })
    return { ok: true, text }
  } catch {
    return { ok: false, error: '[Verschlüsselt] Entschlüsselung fehlgeschlagen.' }
  }
}
