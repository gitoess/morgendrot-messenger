'use client'

import { decryptIotaPeerSessionMessageDetailed } from '@morgendrot/shared/morgendrot-crypto-session-wire'
import { deriveSharedSecret } from '@morgendrot/shared/morgendrot-crypto'
import {
  getDirectChatEcdhMaterialForRecipient,
  getDirectChatEcdhPrivateKey,
  getDirectChatEcdhPeerPubBase64,
  restoreDirectChatEcdhPrivateFromLocalStorage,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { base64ToUint8 } from '@morgendrot/shared/bytes-base64'
import {
  getPeerSessionArchiveForRecipient,
  mergeDirectSessionKeysFromPeerMap,
} from '@/frontend/lib/direct-session-keys-archive'
import { getDirectChainFieldIdsFromLs, getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import { ensureDirectChatPeerPubForRecipient } from '@/frontend/lib/direct-iota-encrypted-send-prep'
import { tryAutoRestoreDirectChatEcdhPrivateKey } from '@/frontend/lib/direct-iota-vault-unlock-sync'
import { resolveRatchetLayerAfterOuterDecrypt } from '@/frontend/lib/ratchet-after-outer-decrypt'
import { looksLikeRatchetV3Wire } from '@/frontend/lib/ratchet-experiment'

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

function normAddr(a: string): string {
  return a.trim().toLowerCase()
}

export type EncryptedInboxPayload = {
  iv: Uint8Array
  ciphertext: Uint8Array
  tag: Uint8Array
}

export type DecryptDirectInboxMeta = {
  /** Chain-Absender — für Ausgangs-Echo. */
  sender?: string
  recipient?: string
}

export async function decryptDirectInboxEncryptedPayload(
  peerAddr: string,
  payload: EncryptedInboxPayload,
  meta?: DecryptDirectInboxMeta
): Promise<
  { ok: true; text: string; innerEnc?: 'ratchet_v3' } | { ok: false; error: string }
> {
  if (!getDirectChatEcdhPrivateKey()) {
    await tryAutoRestoreDirectChatEcdhPrivateKey()
  }
  if (!getDirectChatEcdhPrivateKey()) {
    await restoreDirectChatEcdhPrivateFromLocalStorage()
  }
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
    const outer = await decryptIotaPeerSessionMessageDetailed({
      iv: payload.iv,
      ciphertext: payload.ciphertext,
      tag: payload.tag,
      myAddress,
      peerAddress: peerAddr.trim(),
      myPrivKey: mat.ecdhPrivateKey,
      peerPubRaw: mat.peerPubRaw,
      sessionArchive: getPeerSessionArchiveForRecipient(peerAddr),
    })
    /** Ratchet-Root muss zum Outer-Pub passen (Archiv kann ≠ Live-Pub sein). */
    const ecdhShared = await deriveSharedSecret(mat.ecdhPrivateKey, outer.peerPubUsed)
    const iAmSender = Boolean(meta?.sender && normAddr(meta.sender) === normAddr(myAddress))
    const wasRatchet = looksLikeRatchetV3Wire(outer.plaintext)
    const resolved = await resolveRatchetLayerAfterOuterDecrypt({
      text: outer.plaintext,
      peerAddress: peerAddr,
      myAddress,
      iAmSender,
      ecdhShared,
    })
    return {
      ok: true,
      text: resolved,
      ...(wasRatchet ? { innerEnc: 'ratchet_v3' as const } : {}),
    }
  } catch {
    return { ok: false, error: '[Verschlüsselt] Entschlüsselung fehlgeschlagen.' }
  }
}
