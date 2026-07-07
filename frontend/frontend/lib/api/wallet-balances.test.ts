import { describe, expect, it } from 'vitest'
import { mergeWalletBalancesIntoApiStatus } from '@/frontend/lib/api/wallet-balances'

describe('mergeWalletBalancesIntoApiStatus', () => {
  it('merges testnet and mainnet balances into api snapshot', () => {
    const merged = mergeWalletBalancesIntoApiStatus(
      { role: 'boss', backendOnline: true },
      {
        ok: true,
        walletNativeIotaBalanceNetwork: 'testnet',
        walletNativeIotaBalanceTestnet: { mist: '1000000000', displayIota: '1' },
        walletNativeIotaBalanceMainnet: { mist: '0', displayIota: '0' },
      }
    )
    expect(merged.walletNativeIotaBalanceTestnet?.displayIota).toBe('1')
    expect(merged.walletNativeIotaBalanceMainnet?.displayIota).toBe('0')
    expect(merged.walletNativeIotaBalanceNetwork).toBe('testnet')
  })
})
