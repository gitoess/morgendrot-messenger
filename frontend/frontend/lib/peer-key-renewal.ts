import { setDirectChatEcdhPeerPubBase64 } from '@/frontend/lib/direct-chat-ecdh-session'
import { invalidateChainHandshakeProbe } from '@/frontend/lib/chain-handshake-probe-cache'
import { isValidRecipient0x, normalizeRecipient0x } from '@/frontend/lib/encrypted-recipient-handshake-status'

export const PEER_KEY_RENEWAL_CONFIRM =
  'Verschlüsselung mit diesem Kontakt neu aufsetzen?\n\n' +
  '• Dein lokaler Peer-Schlüssel wird entfernt.\n' +
  '• Ein neuer Handshake wird an die Chain gesendet.\n' +
  '• Der Partner muss antworten, bevor wieder verschlüsselt gesendet werden kann.\n' +
  '• Bereits empfangene Nachrichten bleiben im Verlauf; Entschlüsselung mit neuem Schlüssel ist ggf. nicht möglich (siehe docs/CHAT-ECDH-SCHLUESSEL-ERNEUERN.md).\n\n' +
  'Fortfahren?'

/** Entfernt gespeicherten Peer-Pub für genau eine 0x-Adresse. */
export function clearDirectChatEcdhPeerPubForRecipient(recipientHex: string): { ok: true } | { ok: false; error: string } {
  return setDirectChatEcdhPeerPubBase64(recipientHex, '')
}

/**
 * Phase 1 — Schlüssel-Erneuerung: lokales ECDH-Material verwerfen, neuen Handshake anstoßen.
 * Kein Double Ratchet; siehe docs/CHAT-ECDH-SCHLUESSEL-ERNEUERN.md.
 */
export async function renewDirectChatPeerEncryption(
  peerAddress: string,
  opts: { onHandshake: (address: string) => void | Promise<void> }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const addr = normalizeRecipient0x(peerAddress)
  if (!isValidRecipient0x(addr)) {
    return { ok: false, error: 'Gültige Partner-Wallet (0x + 64 Hex) erforderlich.' }
  }
  const cleared = clearDirectChatEcdhPeerPubForRecipient(addr)
  if (!cleared.ok) return cleared
  invalidateChainHandshakeProbe(addr)
  await opts.onHandshake(addr)
  return { ok: true }
}
