import { describe, expect, it } from 'vitest'
import { generateMnemonicKeypairLocally } from '@/frontend/lib/generate-mnemonic-local'
import {
  getCreateUnlockHintKeys,
  isPlausibleSdkImport,
  isVaultUnlockButtonDisabled,
} from '@/frontend/lib/dashboard-unlock'

const baseGate = {
  unlocking: false,
  unlockMode: 'create' as const,
  signerKind: 'sdk' as const,
  showSignerImportOpen: false,
  standaloneHelperUnlock: false,
  standaloneWithoutBasis: true,
  passwordConfirm: '',
  signerImportConfirm: '',
}

describe('isPlausibleSdkImport with local keypair', () => {
  it('akzeptiert lokal erzeugtes IOTA-Secret (generate-mnemonic)', () => {
    const r = generateMnemonicKeypairLocally()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(isPlausibleSdkImport(r.secretKey)).toBe(true)
  })
})

describe('isVaultUnlockButtonDisabled create (standalone APK)', () => {
  it('bleibt gesperrt ohne Passwort-Wiederholung', () => {
    const r = generateMnemonicKeypairLocally()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const disabled = isVaultUnlockButtonDisabled({
      ...baseGate,
      signerImport: r.secretKey,
      password: 'geheim123',
      passwordConfirm: '',
    })
    expect(disabled).toBe(true)
    expect(getCreateUnlockHintKeys({
      ...baseGate,
      signerImport: r.secretKey,
      password: 'geheim123',
      passwordConfirm: '',
    })).toContain('passwordConfirmMissing')
  })

  it('bleibt gesperrt bei zu kurzem Passwort', () => {
    const r = generateMnemonicKeypairLocally()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(
      isVaultUnlockButtonDisabled({
        ...baseGate,
        signerImport: r.secretKey,
        password: 'kurz',
        passwordConfirm: 'kurz',
      })
    ).toBe(true)
  })

  it('öffnet bei Seed + passendem Passwort (≥8)', () => {
    const r = generateMnemonicKeypairLocally()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(
      isVaultUnlockButtonDisabled({
        ...baseGate,
        unlockMode: 'import',
        signerImport: r.secretKey,
        password: 'geheim123',
        passwordConfirm: 'geheim123',
      })
    ).toBe(false)
  })
})
