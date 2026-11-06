/**
 * Beim Vault-/Session-Lock: Chat-Passphrase-Klartext aus RAM.
 * Ciphertext (Vault-Passwort-Sidecar) bleibt — nach Unlock wieder verfügbar.
 * ImageNFT-Passphrasen bleiben (eigene Galerie) —
 * werden bei Einsatz-Ende / clearAllEvidencePassphrases entfernt.
 * ECDH-Material: clearDirectChatEcdhKeyMaterial separat.
 */
import { lockPassphraseMessageVault } from '@/frontend/lib/passphrase-message-local-store'

export function wipeLocalPassphraseStoresOnLock(): void {
  lockPassphraseMessageVault()
}
