import { describe, expect, it } from 'vitest'
import { preferUnlockModeWhenLocalVaultExists } from '@/frontend/lib/vault-unlock-mode-prefer'

describe('preferUnlockModeWhenLocalVaultExists', () => {
  it('korrigiert create → vault wenn Datei da und User nicht gewählt hat', () => {
    expect(
      preferUnlockModeWhenLocalVaultExists({
        locked: true,
        hasLocalVault: true,
        unlockMode: 'create',
        userChoseCreate: false,
      })
    ).toBe('vault')
  })

  it('lässt User-Wahl create stehen', () => {
    expect(
      preferUnlockModeWhenLocalVaultExists({
        locked: true,
        hasLocalVault: true,
        unlockMode: 'create',
        userChoseCreate: true,
      })
    ).toBeNull()
  })

  it('kein Eingriff ohne Vault / wenn schon vault / wenn entsperrt', () => {
    expect(
      preferUnlockModeWhenLocalVaultExists({
        locked: true,
        hasLocalVault: false,
        unlockMode: 'create',
        userChoseCreate: false,
      })
    ).toBeNull()
    expect(
      preferUnlockModeWhenLocalVaultExists({
        locked: true,
        hasLocalVault: true,
        unlockMode: 'vault',
        userChoseCreate: false,
      })
    ).toBeNull()
    expect(
      preferUnlockModeWhenLocalVaultExists({
        locked: false,
        hasLocalVault: true,
        unlockMode: 'create',
        userChoseCreate: false,
      })
    ).toBeNull()
  })
})
