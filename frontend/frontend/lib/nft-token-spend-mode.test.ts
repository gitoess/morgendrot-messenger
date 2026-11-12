import { describe, expect, it } from 'vitest'
import {
  nftTokenSpendModeLabel,
  nftTokenSpendModeOptionLabel,
  readNftTokenSpendMode,
  writeNftTokenSpendMode,
} from '@/frontend/lib/nft-token-spend-mode'

describe('nft-token-spend-mode', () => {
  it('default guarded; write/read bearer; Kurzlabels', () => {
    writeNftTokenSpendMode('bearer')
    expect(readNftTokenSpendMode()).toBe('bearer')
    writeNftTokenSpendMode('guarded')
    expect(readNftTokenSpendMode()).toBe('guarded')
    expect(nftTokenSpendModeLabel('bearer')).toBe('Karteninhaber')
    expect(nftTokenSpendModeLabel('guarded')).toMatch(/Nur ich/)
    expect(nftTokenSpendModeOptionLabel('bearer')).toBe('Karteninhaber')
    expect(nftTokenSpendModeOptionLabel('guarded')).toMatch(/Nur ich/)
  })
})
