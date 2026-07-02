import { base64ToUint8 } from '@morgendrot/shared/bytes-base64'
import { invalidateChainHandshakeProbe } from '@/frontend/lib/chain-handshake-probe-cache'
import {
  getDirectChatEcdhPeerPubBase64,
  setDirectChatEcdhPeerPubBase64,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { rotatePeerSessionEpochForRecipient } from '@/frontend/lib/direct-session-keys-archive'
import { executeCommand } from '@/frontend/lib/api/execute-command'
import { isValidRecipient0x, normalizeRecipient0x } from '@/frontend/lib/encrypted-recipient-handshake-status'

export const PEER_KEY_RENEWAL_CONFIRM =
  'Session-Schlüssel mit diesem Kontakt erneuern (keyEpoch++)?\n\n' +
  '• Der gespeicherte Peer-Schlüssel bleibt erhalten — alte Nachrichten bleiben lesbar.\n' +
  '• Ab sofort wird mit neuer Session-Epoch verschlüsselt (Forward Secrecy ab Rotation).\n' +
  '• Ein neuer Handshake wird an die Chain gesendet; der Partner sollte antworten.\n' +
  '• Bis zur Partner-Antwort kann verschlüsseltes Senden blockiert sein.\n\n' +
  'Fortfahren?'

/** Entfernt gespeicherten Peer-Pub für genau eine 0x-Adresse (Notfall / Legacy). */
export function clearDirectChatEcdhPeerPubForRecipient(recipientHex: string): { ok: true } | { ok: false; error: string } {
  return setDirectChatEcdhPeerPubBase64(recipientHex, '')
}

export type RenewDirectChatPeerEncryptionResult =
  | { ok: true; newEpoch: number }
  | { ok: false; error: string }

/**
 * § H.23 A4 — Schlüssel-Erneuerung: keyEpoch++ im Session-Archiv, Handshake anstoßen.
 * Peer-Pub wird nicht mehr blind gelöscht.
 */
export async function renewDirectChatPeerEncryption(
  peerAddress: string,
  opts: { onHandshake: (address: string) => void | Promise<void> }
): Promise<RenewDirectChatPeerEncryptionResult> {
  const addr = normalizeRecipient0x(peerAddress)
  if (!isValidRecipient0x(addr)) {
    return { ok: false, error: 'Gültige Partner-Wallet (0x + 64 Hex) erforderlich.' }
  }
  const peerB64 = getDirectChatEcdhPeerPubBase64(addr)
  if (!peerB64) {
    return {
      ok: false,
      error: 'Kein Peer-Pub gespeichert — zuerst Handshake/Connect abschließen.',
    }
  }
  let peerPubRaw: Uint8Array
  try {
    peerPubRaw = base64ToUint8(peerB64)
  } catch {
    return { ok: false, error: 'Peer-Pub ungültig.' }
  }
  const rotated = rotatePeerSessionEpochForRecipient(addr, peerPubRaw)
  if (!rotated.ok) return rotated

  try {
    await executeCommand('/rotate-session-epoch', [addr])
  } catch {
    /* Standalone ohne Boss-API */
  }

  invalidateChainHandshakeProbe(addr)
  await opts.onHandshake(addr)
  return { ok: true, newEpoch: rotated.newEpoch }
}
