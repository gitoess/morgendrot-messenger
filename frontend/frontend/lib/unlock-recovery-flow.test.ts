import { describe, expect, it } from 'vitest'
import { shouldOfferRecoveryAfterUnlock } from '@/frontend/lib/unlock-recovery-flow'
import type { ApiStatus } from '@/frontend/lib/api'

function makeStatus(overrides: Partial<ApiStatus> = {}): ApiStatus {
  return {
    connected: true,
    locked: false,
    myAddress: '0x' + '11'.repeat(32),
    network: 'localnet',
    packageId: '0x' + '22'.repeat(32),
    role: 'messenger',
    connectedAddresses: [],
    signer: 'sdk',
    vaultStatus: { hasLocal: true },
    uiVariant: 'full',
    ...overrides,
  }
}

describe('shouldOfferRecoveryAfterUnlock', () => {
  it('returns true for unlocked sdk with local vault', () => {
    expect(shouldOfferRecoveryAfterUnlock(makeStatus())).toBe(true)
  })

  it('returns false when vault is missing or signer is not sdk', () => {
    expect(shouldOfferRecoveryAfterUnlock(makeStatus({ vaultStatus: { hasLocal: false } }))).toBe(false)
    expect(shouldOfferRecoveryAfterUnlock(makeStatus({ signer: 'cli' }))).toBe(false)
  })

  it('returns false while locked or without status', () => {
    expect(shouldOfferRecoveryAfterUnlock(makeStatus({ locked: true }))).toBe(false)
    expect(shouldOfferRecoveryAfterUnlock(null)).toBe(false)
  })
})
