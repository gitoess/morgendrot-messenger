import { describe, expect, it } from 'vitest'
import {
  nftTokenSpendModeLabel,
  readNftTokenSpendMode,
  writeNftTokenSpendMode,
} from '@/frontend/lib/nft-token-spend-mode'

describe('nft-token-spend-mode', () => {
  it('default guarded; write/read bearer', () => {
    writeNftTokenSpendMode('bearer')
    expect(readNftTokenSpendMode()).toBe('bearer')
    writeNftTokenSpendMode('guarded')
    expect(readNftTokenSpendMode()).toBe('guarded')
    expect(nftTokenSpendModeLabel('bearer')).toMatch(/Bearer/i)
    expect(nftTokenSpendModeLabel('guarded')).toMatch(/Guarded/i)
  })
})
