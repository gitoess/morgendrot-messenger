/**
 * Purse/Treasury-Metadaten gehören in den Tresor (wie Schlüsselkarte).
 * Ohne entsperrte Session: kein dauerhaftes Merken — UI soll unlock fordern.
 */

import { hasVaultPasswordSession } from '@/frontend/lib/vault-password-session'
import { hasVaultEncSidecar } from '@/frontend/lib/vault-enc-sidecar'
import { NFT_VAULT_INDEX_ENC_LS_KEY } from '@/frontend/lib/nft-vault-index-vault'
import { NFT_KEYCARD_ENC_LS_KEY } from '@/frontend/lib/nft-keycard-local-store'

export const NFT_VAULT_SESSION_REQUIRED_MSG =
  'Tresor entsperren — Purse/Treasury-Index und Schlüsselkarte liegen im Vault (wie Chat-Geheimnisse). Sonst gehen Bindungen nach Versand/Gerät verloren.'

export function isNftVaultMetaSessionOpen(): boolean {
  return hasVaultPasswordSession()
}

export function assertNftVaultMetaSession(): { ok: true } | { ok: false; error: string } {
  if (hasVaultPasswordSession()) return { ok: true }
  return { ok: false, error: NFT_VAULT_SESSION_REQUIRED_MSG }
}

/** Hinweistext für UI (gesperrt / noch nie angelegt). */
export function nftVaultSessionHint(): string {
  if (hasVaultPasswordSession()) return ''
  const hasSidecar =
    hasVaultEncSidecar(NFT_VAULT_INDEX_ENC_LS_KEY) || hasVaultEncSidecar(NFT_KEYCARD_ENC_LS_KEY)
  return hasSidecar
    ? 'Tresor gesperrt — Index/Schlüsselkarte im Vault. Auszahlen braucht Signer; Index speichern braucht entsperrten Tresor.'
    : 'Auszahlen braucht Signer. Index/Digests dauerhaft speichern und Guthaben anlegen: Tresor entsperren.'
}
