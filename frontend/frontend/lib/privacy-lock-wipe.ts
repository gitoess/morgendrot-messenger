/**
 * Beim Vault-/Session-Lock: Chat-/ImageNFT-Passphrasen, Team-Keys und
 * NFT-Schlüsselkarte aus RAM (+ Tab-Backups). Enc-Sidecars bleiben.
 * ECDH-Material: clearDirectChatEcdhKeyMaterial separat.
 */
import { lockLocalSecretVaults } from '@/frontend/lib/local-secret-vaults'

export function wipeLocalPassphraseStoresOnLock(): void {
  lockLocalSecretVaults()
}
