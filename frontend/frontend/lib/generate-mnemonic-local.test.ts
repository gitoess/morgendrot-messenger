import { describe, expect, it } from 'vitest'
import { generateMnemonicKeypairLocally } from '@/frontend/lib/generate-mnemonic-local'

const ADDR = /^0x[a-fA-F0-9]{64}$/

describe('generateMnemonicKeypairLocally', () => {
  it('liefert gültige Adresse und Secret', () => {
    const r = generateMnemonicKeypairLocally()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.address).toMatch(ADDR)
    expect(r.secretKey.length).toBeGreaterThan(10)
  })

  it('erzeugt verschiedene Adressen', () => {
    const a = generateMnemonicKeypairLocally()
    const b = generateMnemonicKeypairLocally()
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.address).not.toBe(b.address)
  })
})
