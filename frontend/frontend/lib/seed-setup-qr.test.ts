import { describe, expect, it } from 'vitest'
import { buildSeedSetupQrText, parseSeedSetupFromQrText } from './seed-setup-qr'

describe('seed-setup-qr', () => {
  it('roundtrip mnemonic payload', () => {
    const w = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const text = buildSeedSetupQrText({ seedImport: w, address: '0x' + 'a'.repeat(64) })
    const parsed = parseSeedSetupFromQrText(text)
    expect(parsed?.seedImport).toBe(w)
    expect(parsed?.address).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(JSON.parse(text).s).toBe('morgendrot-seed-setup-v1')
  })

  it('accepts legacy QR without s field', () => {
    const legacy = JSON.stringify({ v: 1, k: 'ms', w: 'word '.repeat(12).trim() })
    expect(parseSeedSetupFromQrText(legacy)?.seedImport.split(/\s+/).length).toBeGreaterThanOrEqual(12)
  })

  it('rejects mesh bundle', () => {
    expect(parseSeedSetupFromQrText(JSON.stringify({ v: 1, salt: 'x' }))).toBeNull()
  })
})
