/**
 * Wenn lokal schon eine Vault-Datei existiert, soll der Unlock-Dialog
 * nicht fälschlich auf „Neu anlegen“ stehen (Race: Status-Poll nach erstem locked-Render).
 * Explizite User-Wahl „create“ bleibt erhalten.
 */

export type VaultUnlockModePrefer = 'vault' | 'create' | 'import'

export function preferUnlockModeWhenLocalVaultExists(input: {
  locked: boolean
  hasLocalVault: boolean
  unlockMode: VaultUnlockModePrefer
  userChoseCreate: boolean
}): VaultUnlockModePrefer | null {
  if (!input.locked) return null
  if (!input.hasLocalVault) return null
  if (input.unlockMode !== 'create') return null
  if (input.userChoseCreate) return null
  return 'vault'
}
