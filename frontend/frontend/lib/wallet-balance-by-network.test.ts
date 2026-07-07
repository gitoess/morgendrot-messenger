import { describe, expect, it } from 'vitest'
import {
  pickWalletBalanceForNetwork,
  walletHasGasForNetwork,
} from '@/frontend/lib/wallet-balance-by-network'

const bal = (mist: string) => ({ mist, displayIota: mist === '0' ? '0' : '1' })

describe('pickWalletBalanceForNetwork', () => {
  it('nutzt netzwerk-spezifische Felder', () => {
    const api = {
      walletNativeIotaBalanceNetwork: 'testnet',
      walletNativeIotaBalanceTestnet: bal('1000'),
      walletNativeIotaBalanceMainnet: bal('5000'),
    } as never
    expect(pickWalletBalanceForNetwork(api, 'mainnet')?.mist).toBe('5000')
    expect(pickWalletBalanceForNetwork(api, 'testnet')?.mist).toBe('1000')
  })

  it('fällt auf aktives Saldo zurück', () => {
    const api = {
      walletNativeIotaBalanceNetwork: 'testnet',
      walletNativeIotaBalance: bal('2000'),
    } as never
    expect(pickWalletBalanceForNetwork(api, 'testnet')?.mist).toBe('2000')
  })
})

describe('walletHasGasForNetwork', () => {
  it('erkennt leeren Mainnet-Saldo', () => {
    expect(
      walletHasGasForNetwork({ walletNativeIotaBalanceMainnet: bal('0') } as never, 'mainnet')
    ).toBe(false)
  })
})
