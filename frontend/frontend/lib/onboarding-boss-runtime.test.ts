import { describe, expect, it, vi } from 'vitest'
import {
  buildBossOnboardingRuntime,
  enrichBossWizardApiSnapshot,
  resolveBossWizardAddress,
} from '@/frontend/lib/onboarding-boss-runtime'

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSignerAddress: () => null,
}))

vi.mock('@/frontend/lib/messenger-session-keys-ready', () => ({
  isBrowserSessionSignerReady: (locked: boolean) => !locked,
}))

describe('onboarding-boss-runtime', () => {
  const addr = '0x' + 'a'.repeat(64)

  it('resolveBossWizardAddress nutzt myAddress Fallback', () => {
    expect(resolveBossWizardAddress({ myAddress: addr }, null)).toBe(addr)
    expect(resolveBossWizardAddress({}, addr)).toBe(addr)
  })

  it('enrichBossWizardApiSnapshot lässt Server-Status unverändert', () => {
    const enriched = enrichBossWizardApiSnapshot({ myAddressFull: addr }, `0x${'x'.repeat(64)}`)
    expect(enriched?.myAddressFull).toBe(addr)
  })

  it('needsVaultUnlock bei Server-Adresse ohne Browser-Signer', () => {
    const r = buildBossOnboardingRuntime(
      { myAddressFull: addr, locked: true, hasKeys: false },
      true
    )
    expect(r.needsNewWallet).toBe(false)
    expect(r.needsVaultUnlock).toBe(true)
    expect(r.displayAddress).toBe(addr)
  })
})
