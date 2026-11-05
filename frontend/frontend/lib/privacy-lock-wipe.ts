/**
 * Beim Vault-/Session-Lock: Chat-Passphrase-Nachrichten-Merker leeren.
 * ImageNFT-Passphrasen bleiben (eigene Galerie ohne erneute Eingabe) —
 * werden bei Einsatz-Ende / clearAllEvidencePassphrases entfernt.
 * ECDH-Material: clearDirectChatEcdhKeyMaterial separat.
 */
import { clearAllPassphraseMessagePassphrases } from '@/frontend/lib/passphrase-message-local-store'

export function wipeLocalPassphraseStoresOnLock(): void {
  clearAllPassphraseMessagePassphrases()
}
