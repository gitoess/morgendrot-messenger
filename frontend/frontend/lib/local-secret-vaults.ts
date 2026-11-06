/**
 * Ein Unlock/Lock/Purge für alle lokalen Geheimnis-Sidecars (Vault-Passwort):
 * Chat-Passphrasen, ImageNFT-Passphrasen, Team-Keys, NFT-Schlüsselkarte.
 */

import {
  lockEvidencePassphraseVault,
  purgeEvidencePassphraseVault,
  unlockEvidencePassphraseVault,
} from '@/frontend/lib/evidence-passphrase-local-store'
import {
  lockNftKeycardVault,
  purgeNftKeycardVault,
  unlockNftKeycardVault,
} from '@/frontend/lib/nft-keycard-local-store'
import {
  lockPassphraseMessageVault,
  purgePassphraseMessageVault,
  unlockPassphraseMessageVault,
} from '@/frontend/lib/passphrase-message-local-store'
import {
  lockTeamBroadcastKeyVault,
  purgeTeamBroadcastKeyVault,
  unlockTeamBroadcastKeyVault,
} from '@/frontend/lib/team-broadcast-key-store'
import {
  clearVaultPasswordSession,
  setVaultPasswordSession,
} from '@/frontend/lib/vault-password-session'

export async function unlockLocalSecretVaults(password: string): Promise<{
  ok: boolean
  errors: string[]
}> {
  const pw = password.trim()
  const errors: string[] = []
  if (pw.length < 8) {
    return { ok: false, errors: ['Vault-Passwort mindestens 8 Zeichen.'] }
  }
  setVaultPasswordSession(pw)

  const msg = await unlockPassphraseMessageVault(pw)
  if (!msg.ok) errors.push(`Chat-Passphrasen: ${msg.error}`)

  const ev = await unlockEvidencePassphraseVault(pw)
  if (!ev.ok) errors.push(`ImageNFT-Passphrasen: ${ev.error}`)

  const team = await unlockTeamBroadcastKeyVault(pw)
  if (!team.ok) errors.push(`Team-Keys: ${team.error}`)

  const nft = await unlockNftKeycardVault(pw)
  if (!nft.ok) errors.push(`NFT-Schlüsselkarte: ${nft.error}`)

  if (errors.length > 0) {
    // Kein halboffenes Vault-Passwort in der Session belassen.
    lockPassphraseMessageVault()
    lockEvidencePassphraseVault()
    lockTeamBroadcastKeyVault()
    lockNftKeycardVault()
    clearVaultPasswordSession()
    return { ok: false, errors }
  }
  return { ok: true, errors: [] }
}

export function lockLocalSecretVaults(): void {
  lockPassphraseMessageVault()
  lockEvidencePassphraseVault()
  lockTeamBroadcastKeyVault()
  lockNftKeycardVault()
  clearVaultPasswordSession()
}

export function purgeLocalSecretVaults(): void {
  purgePassphraseMessageVault()
  purgeEvidencePassphraseVault()
  purgeTeamBroadcastKeyVault()
  purgeNftKeycardVault()
  clearVaultPasswordSession()
}
