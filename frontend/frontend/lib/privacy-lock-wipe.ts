/**
 * Beim Vault-/Session-Lock: Chat- + ImageNFT-Passphrasen aus RAM.
 * Ciphertext-Sidecars bleiben — nach Unlock wieder verfügbar.
 * ECDH-Material: clearDirectChatEcdhKeyMaterial separat.
 */
import { lockLocalSecretVaults } from '@/frontend/lib/local-secret-vaults'

export function wipeLocalPassphraseStoresOnLock(): void {
  lockLocalSecretVaults()
}
