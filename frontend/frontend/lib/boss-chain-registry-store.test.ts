import { beforeEach, describe, expect, it } from 'vitest'
import {
  persistBossChainRegistryIds,
  readBossChainRegistryIds,
  syncBossChainRegistryIdsFromEinsatzConfig,
} from '@/frontend/lib/boss-chain-registry-store'

const CR = '0x' + 'a'.repeat(64)
const VR = '0x' + 'b'.repeat(64)

describe('boss-chain-registry-store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persist + read roundtrip', () => {
    persistBossChainRegistryIds({ commandRegistryId: CR, vaultRegistryId: VR })
    expect(readBossChainRegistryIds()).toEqual({
      commandRegistryId: CR,
      vaultRegistryId: VR,
    })
  })

  it('sync from einsatzConfig', () => {
    syncBossChainRegistryIdsFromEinsatzConfig({
      commandRegistryId: CR,
      vaultRegistryId: VR,
    })
    expect(readBossChainRegistryIds().commandRegistryId).toBe(CR)
  })
})
