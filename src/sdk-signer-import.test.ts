import { describe, expect, it } from 'vitest'
import { isPlausibleSdkImport } from './messenger-nest/sdk-signer-import.js'

describe('isPlausibleSdkImport', () => {
  it('akzeptiert 12-Wort-Mnemonic', () => {
    const words = Array.from({ length: 12 }, (_, i) => `word${i}`).join(' ')
    expect(isPlausibleSdkImport(words)).toBe(true)
  })

  it('lehnt kurzen Text ab', () => {
    expect(isPlausibleSdkImport('abc')).toBe(false)
  })
})
