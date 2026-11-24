import { describe, expect, it } from 'vitest'
import { shouldApplyVaultFailClosedOverlay } from '@/frontend/lib/vault-fail-closed'

describe('shouldApplyVaultFailClosedOverlay', () => {
  it('aus wenn Tresor offen', () => {
    expect(shouldApplyVaultFailClosedOverlay({ vaultSessionLocked: false })).toBe(false)
  })

  it('an bei Hard-Lock ohne Suppress', () => {
    expect(shouldApplyVaultFailClosedOverlay({ vaultSessionLocked: true })).toBe(true)
  })

  it('an bei Soft-Lock (UI-Pause)', () => {
    expect(
      shouldApplyVaultFailClosedOverlay({
        vaultSessionLocked: false,
        privacySoftLocked: true,
      })
    ).toBe(true)
  })

  it('aus bei Helper-Seed-Suppress', () => {
    expect(
      shouldApplyVaultFailClosedOverlay({
        vaultSessionLocked: true,
        suppressForHelperSeed: true,
      })
    ).toBe(false)
  })

  it('aus bei Onboarding-Wizard-Suppress', () => {
    expect(
      shouldApplyVaultFailClosedOverlay({
        vaultSessionLocked: true,
        suppressForOnboardingWizard: true,
      })
    ).toBe(false)
  })
})
