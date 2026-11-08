/**
 * Ein Unlock/Lock/Purge für alle lokalen Geheimnis-Sidecars (Vault-Passwort):
 * Chat-Passphrasen, ImageNFT-Passphrasen, Team-Keys, NFT-Schlüsselkarte, Ratchet (C1.4).
 *
 * Unlock ist best-effort: ein kaputter/fremder Sidecar darf die anderen
 * nicht wieder aus dem RAM werfen (sonst Soft-Unlock „ok“, Merker trotzdem weg).
 */

import {
  flushEvidencePassphraseVaultPersist,
  lockEvidencePassphraseVault,
  purgeEvidencePassphraseVault,
  unlockEvidencePassphraseVault,
} from '@/frontend/lib/evidence-passphrase-local-store'
import {
  flushNftKeycardVaultPersist,
  lockNftKeycardVault,
  purgeNftKeycardVault,
  unlockNftKeycardVault,
} from '@/frontend/lib/nft-keycard-local-store'
import {
  flushNftVaultIndexVaultPersist,
  lockNftVaultIndexVault,
  purgeNftVaultIndexVault,
  unlockNftVaultIndexVault,
} from '@/frontend/lib/nft-vault-index-vault'
import {
  flushPassphraseMessageVaultPersist,
  lockPassphraseMessageVault,
  purgePassphraseMessageVault,
  unlockPassphraseMessageVault,
} from '@/frontend/lib/passphrase-message-local-store'
import {
  flushRatchetSessionVaultPersist,
  lockRatchetSessionVault,
  purgeRatchetSessionVault,
  unlockRatchetSessionVault,
} from '@/frontend/lib/ratchet-session-local-store'
import {
  flushTeamBroadcastKeyVaultPersist,
  lockTeamBroadcastKeyVault,
  purgeTeamBroadcastKeyVault,
  unlockTeamBroadcastKeyVault,
} from '@/frontend/lib/team-broadcast-key-store'
import {
  clearVaultPasswordSession,
  setVaultPasswordSession,
} from '@/frontend/lib/vault-password-session'

export async function unlockLocalSecretVaults(password: string): Promise<{
  /** True wenn Chat-Passphrasen-Vault geöffnet (primär für Soft-Unlock / Merken). */
  ok: boolean
  passphraseOk: boolean
  errors: string[]
}> {
  const pw = password.trim()
  const errors: string[] = []
  if (pw.length < 8) {
    return { ok: false, passphraseOk: false, errors: ['Vault-Passwort mindestens 8 Zeichen.'] }
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

  const vaultIdx = await unlockNftVaultIndexVault(pw)
  if (!vaultIdx.ok) errors.push(`Vault-Index (Purse/Treasury): ${vaultIdx.error}`)

  const ratchet = await unlockRatchetSessionVault(pw)
  if (!ratchet.ok) errors.push(`Ratchet: ${ratchet.error}`)

  const passphraseOk = msg.ok
  const anyOk = msg.ok || ev.ok || team.ok || nft.ok || vaultIdx.ok || ratchet.ok
  if (!anyOk) {
    clearVaultPasswordSession()
    return { ok: false, passphraseOk: false, errors }
  }
  // Session behalten — Persistenz braucht sie, auch bei Teilfehlern anderer Sidecars.
  return { ok: passphraseOk, passphraseOk, errors }
}

/** Debounce-Sidecars sofort schreiben — vor Lock, sonst fehlen frische „merken“-Einträge. */
export async function flushLocalSecretVaultsPersist(): Promise<void> {
  await Promise.all([
    flushPassphraseMessageVaultPersist(),
    flushEvidencePassphraseVaultPersist(),
    flushTeamBroadcastKeyVaultPersist(),
    flushNftKeycardVaultPersist(),
    flushNftVaultIndexVaultPersist(),
    flushRatchetSessionVaultPersist(),
  ])
}

export function lockLocalSecretVaults(): void {
  lockPassphraseMessageVault()
  lockEvidencePassphraseVault()
  lockTeamBroadcastKeyVault()
  lockNftKeycardVault()
  lockNftVaultIndexVault()
  lockRatchetSessionVault()
  clearVaultPasswordSession()
}

export function purgeLocalSecretVaults(): void {
  purgePassphraseMessageVault()
  purgeEvidencePassphraseVault()
  purgeTeamBroadcastKeyVault()
  purgeNftKeycardVault()
  purgeNftVaultIndexVault()
  purgeRatchetSessionVault()
  clearVaultPasswordSession()
}
