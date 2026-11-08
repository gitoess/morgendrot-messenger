import { describe, expect, it } from 'vitest'
import {
  nftTokenSpendModeLabel,
  nftTokenSpendModeOptionLabel,
  readNftTokenSpendMode,
  writeNftTokenSpendMode,
} from '@/frontend/lib/nft-token-spend-mode'

describe('nft-token-spend-mode', () => {
  it('default guarded; write/read bearer; hybrid labels', () => {
    writeNftTokenSpendMode('bearer')
    expect(readNftTokenSpendMode()).toBe('bearer')
    writeNftTokenSpendMode('guarded')
    expect(readNftTokenSpendMode()).toBe('guarded')
    expect(nftTokenSpendModeLabel('bearer')).toMatch(/Bearer/i)
    expect(nftTokenSpendModeLabel('bearer')).toMatch(/nur NFT/i)
    expect(nftTokenSpendModeLabel('guarded')).toMatch(/Guarded/i)
    expect(nftTokenSpendModeLabel('guarded')).toMatch(/Wallet/i)
    expect(nftTokenSpendModeOptionLabel('bearer')).toMatch(/Bearer/)
    expect(nftTokenSpendModeOptionLabel('guarded')).toMatch(/Guarded/)
  })
})
