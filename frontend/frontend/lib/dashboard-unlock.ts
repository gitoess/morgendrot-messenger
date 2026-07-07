export const SIGNER_IMPORT_REQUIRED_CODE = 'SIGNER_IMPORT_REQUIRED' as const

export type DashboardUnlockMode = 'vault' | 'import' | 'create'

export function normalizeSignerWords(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

export function countSignerWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

/** Genug für POST /api/unlock (Mnemonic ≥12 Wörter oder Hex32 / langes Bech32-Secret). */
export function isPlausibleSdkImport(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (countSignerWords(t) >= 12) return true
  const hex = t.replace(/^0x/i, '').replace(/\s+/g, '')
  if (/^[a-fA-F0-9]{64}$/i.test(hex)) return true
  if (!/\s/.test(t) && t.length >= 60 && /^[a-z]{2,30}1[02-9ac-hj-np-z]+$/i.test(t)) return true
  return false
}

export type VaultUnlockGateInput = {
  unlocking: boolean
  unlockMode: DashboardUnlockMode
  signerKind: string | undefined
  password: string
  passwordConfirm: string
  signerImport: string
  signerImportConfirm: string
  showSignerImportOpen: boolean
  standaloneWithoutBasis: boolean
  standaloneHelperUnlock: boolean
}

export type CreateUnlockHintKey =
  | 'seedMissing'
  | 'seedInvalid'
  | 'seedConfirmMissing'
  | 'seedMismatch'
  | 'passwordMissing'
  | 'passwordShort'
  | 'passwordConfirmMissing'
  | 'passwordMismatch'

/** Hinweise für „Profil anlegen“, wenn der Button noch gesperrt ist. */
export function getCreateUnlockHintKeys(input: VaultUnlockGateInput): CreateUnlockHintKey[] {
  if (input.unlockMode !== 'create' || input.unlocking) return []
  const hints: CreateUnlockHintKey[] = []
  const standaloneCreate = input.standaloneWithoutBasis
  const sdkLike = input.signerKind === 'sdk' || input.signerKind == null

  if (standaloneCreate || sdkLike) {
    const seed = input.signerImport.trim()
    if (!seed) hints.push('seedMissing')
    else if (!isPlausibleSdkImport(seed)) hints.push('seedInvalid')
  }

  if (!standaloneCreate && input.signerKind === 'sdk') {
    const sa = input.signerImport.trim()
    const sb = input.signerImportConfirm.trim()
    if (!sb) hints.push('seedConfirmMissing')
    else if (normalizeSignerWords(sa) !== normalizeSignerWords(sb)) hints.push('seedMismatch')
  }

  if (!input.password.trim()) hints.push('passwordMissing')
  else if (standaloneCreate && input.password.length < 8) hints.push('passwordShort')

  if (!input.passwordConfirm.trim()) hints.push('passwordConfirmMissing')
  else if (input.password !== input.passwordConfirm.trim()) hints.push('passwordMismatch')

  return hints
}

/** Hinweise für „Profil wiederherstellen“ (Seed importieren). */
export function getImportUnlockHintKeys(input: VaultUnlockGateInput): CreateUnlockHintKey[] {
  if (input.unlockMode !== 'import' || input.unlocking) return []
  const sdkImport = input.signerKind === 'sdk' || input.signerKind == null
  if (!sdkImport) return []

  const hints: CreateUnlockHintKey[] = []
  const seed = input.signerImport.trim()
  if (!seed) hints.push('seedMissing')
  else if (!isPlausibleSdkImport(seed)) hints.push('seedInvalid')

  if (!input.password.trim()) hints.push('passwordMissing')
  else if (input.password.length < 8) hints.push('passwordShort')

  if (!input.passwordConfirm.trim()) hints.push('passwordConfirmMissing')
  else if (input.password !== input.passwordConfirm.trim()) hints.push('passwordMismatch')

  return hints
}

export function isVaultUnlockButtonDisabled(input: VaultUnlockGateInput): boolean {
  const importMnemonicRequired =
    input.unlockMode === 'import' && (input.signerKind === 'sdk' || input.signerKind == null)

  if (input.standaloneHelperUnlock) {
    return (
      input.unlocking ||
      !input.signerImport.trim() ||
      !isPlausibleSdkImport(input.signerImport.trim())
    )
  }

  if (input.standaloneWithoutBasis && input.unlockMode === 'create') {
    return getCreateUnlockHintKeys(input).length > 0 || input.unlocking
  }

  if (importMnemonicRequired) {
    return getImportUnlockHintKeys(input).length > 0 || input.unlocking
  }

  return (
    input.unlocking ||
    !input.password.trim() ||
    (input.unlockMode === 'create' &&
      (!input.passwordConfirm.trim() || input.password !== input.passwordConfirm)) ||
    (input.unlockMode === 'create' &&
      input.signerKind === 'sdk' &&
      (!input.signerImport.trim() ||
        !input.signerImportConfirm.trim() ||
        normalizeSignerWords(input.signerImport) !== normalizeSignerWords(input.signerImportConfirm))) ||
    (input.unlockMode === 'vault' &&
      input.signerKind === 'sdk' &&
      input.showSignerImportOpen &&
      !!input.signerImport.trim() &&
      !isPlausibleSdkImport(input.signerImport.trim()))
  )
}
