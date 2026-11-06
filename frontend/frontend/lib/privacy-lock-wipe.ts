/**
 * Beim Vault-/Session-Lock: Chat-/ImageNFT-Passphrasen, Team-Keys und
 * NFT-Schlüsselkarte aus RAM (+ Tab-Backups). Enc-Sidecars bleiben.
 * ECDH-Material: clearDirectChatEcdhKeyMaterial separat.
 *
 * Vor dem RAM-Wipe immer Flush — sonst gehen frische „merken“-Einträge
 * verloren, die nur im Debounce/Tab lagen.
 */
import {
  flushLocalSecretVaultsPersist,
  lockLocalSecretVaults,
} from '@/frontend/lib/local-secret-vaults'

export async function wipeLocalPassphraseStoresOnLock(): Promise<void> {
  await flushLocalSecretVaultsPersist()
  lockLocalSecretVaults()
}
