import { describe, expect, it } from 'vitest'
import { buildIotaTestnetFaucetUrl } from '@morgendrot/shared/iota-testnet-faucet-url'
import {
  bossWizardCanRequestTestnetTokens,
  bossWizardHasTestnetGas,
  requestBossTestnetGas,
} from '@/frontend/lib/boss-wizard-testnet-gas'

const ADDR = '0x' + 'a'.repeat(64)

describe('buildIotaTestnetFaucetUrl', () => {
  it('fügt address-Query hinzu', () => {
    expect(buildIotaTestnetFaucetUrl(ADDR)).toBe(
      `https://faucet.testnet.iota.cafe/?address=${encodeURIComponent(ADDR)}`
    )
  })

  it('unterstützt alternative Basis-URL', () => {
    const url = buildIotaTestnetFaucetUrl(ADDR, { baseUrl: 'https://faucet.example.test/' })
    expect(url).toContain('faucet.example.test')
    expect(url).toContain('address=')
  })
})

describe('bossWizardHasTestnetGas', () => {
  it('erkennt leere Balance', () => {
    expect(bossWizardHasTestnetGas({ walletNativeIotaBalance: { mist: '0', displayIota: '0' } } as never)).toBe(false)
  })

  it('erkennt vorhandenes Gas', () => {
    expect(
      bossWizardHasTestnetGas({ walletNativeIotaBalance: { mist: '1000000000', displayIota: '1' } } as never)
    ).toBe(true)
  })

  it('gibt undefined ohne Balance', () => {
    expect(bossWizardHasTestnetGas({} as never)).toBeUndefined()
  })
})

describe('bossWizardCanRequestTestnetTokens', () => {
  it('erlaubt mit gültiger Adresse', () => {
    expect(bossWizardCanRequestTestnetTokens(ADDR)).toBe(true)
  })

  it('erlaubt mit entsperrter Server-Wallet ohne Client-Adresse', () => {
    expect(bossWizardCanRequestTestnetTokens(undefined, { serverWalletUnlocked: true })).toBe(true)
  })

  it('blockiert ohne Adresse und ohne entsperrte Wallet', () => {
    expect(bossWizardCanRequestTestnetTokens(undefined)).toBe(false)
    expect(bossWizardCanRequestTestnetTokens(undefined, { serverWalletUnlocked: false })).toBe(false)
  })
})

describe('requestBossTestnetGas', () => {
  it('liefert Faucet-URL', () => {
    const r = requestBossTestnetGas(ADDR)
    expect(r.ok).toBe(true)
    expect(r.openUrl).toContain('address=')
  })

  it('öffnet eigenen Link wenn gesetzt', () => {
    const custom = 'https://custom-faucet.test/drop'
    const r = requestBossTestnetGas(undefined, {
      faucetPrefs: { customOpenUrl: custom, faucetBase: '', recipientOverride: '' },
    })
    expect(r.ok).toBe(true)
    expect(r.openUrl).toBe(custom)
  })
})
