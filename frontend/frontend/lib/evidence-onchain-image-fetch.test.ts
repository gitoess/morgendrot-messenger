import { describe, expect, it } from 'vitest'
import { alternateIotaCafeRpcUrl } from '@/frontend/lib/evidence-onchain-image-fetch'

describe('alternateIotaCafeRpcUrl', () => {
  it('wechselt Cafe Testnet ↔ Mainnet', () => {
    expect(alternateIotaCafeRpcUrl('https://api.testnet.iota.cafe')).toBe(
      'https://api.mainnet.iota.cafe'
    )
    expect(alternateIotaCafeRpcUrl('https://api.mainnet.iota.cafe')).toBe(
      'https://api.testnet.iota.cafe'
    )
  })
})
