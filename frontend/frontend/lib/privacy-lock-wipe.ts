/**
 * Beim Vault-/Session-Lock: Klartext-Passphrase-Stores auf diesem Gerät leeren.
 * ECDH-Material wird separat über clearDirectChatEcdhKeyMaterial entfernt.
 */
import { clearAllEvidencePassphrases } from '@/frontend/lib/evidence-passphrase-local-store'
import { clearAllPassphraseMessagePassphrases } from '@/frontend/lib/passphrase-message-local-store'

export function wipeLocalPassphraseStoresOnLock(): void {
  clearAllEvidencePassphrases()
  clearAllPassphraseMessagePassphrases()
}
