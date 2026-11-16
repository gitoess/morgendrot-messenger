import { describe, expect, it } from 'vitest'
import { resolveIotaIndexerRpcUrl } from './resolve-iota-indexer-rpc-url'

describe('resolveIotaIndexerRpcUrl', () => {
  it('mappt cafe api → indexer', () => {
    expect(resolveIotaIndexerRpcUrl('https://api.testnet.iota.cafe')).toBe(
      'https://indexer.testnet.iota.cafe'
    )
    expect(resolveIotaIndexerRpcUrl('https://api.mainnet.iota.cafe/')).toBe(
      'https://indexer.mainnet.iota.cafe'
    )
  })

  it('lässt indexer unverändert', () => {
    expect(resolveIotaIndexerRpcUrl('https://indexer.testnet.iota.cafe')).toBe(
      'https://indexer.testnet.iota.cafe'
    )
  })

  it('unbekannt → undefined', () => {
    expect(resolveIotaIndexerRpcUrl('https://fullnode.testnet.example/')).toBeUndefined()
    expect(resolveIotaIndexerRpcUrl('')).toBeUndefined()
  })
})
