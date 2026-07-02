import { describe, expect, it } from 'vitest'
import { resolveBossWizardDeployNetwork } from '@/frontend/lib/boss-wizard-package-context'

describe('boss-wizard-package-context', () => {
  it('erkennt Testnet aus rpcUrlLabel', () => {
    const n = resolveBossWizardDeployNetwork({
      rpcUrlLabel: 'api.testnet.iota.cafe',
      vaultStatus: { hasLocal: true, network: 'testnet' },
    })
    expect(n.id).toBe('testnet')
    expect(n.label).toContain('Testnet')
    expect(n.deployButtonLabel).toContain('Testnet')
  })

  it('erkennt Mainnet', () => {
    const n = resolveBossWizardDeployNetwork({
      rpcUrlLabel: 'api.mainnet.iota.cafe',
      vaultStatus: { hasLocal: true, network: 'mainnet' },
    })
    expect(n.id).toBe('mainnet')
    expect(n.deployButtonLabel).toContain('Mainnet')
  })
})
