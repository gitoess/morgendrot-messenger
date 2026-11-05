import { describe, expect, it } from 'vitest'
import {
  decryptPassphraseMessageWire,
  encryptPassphraseMessage,
  isPassphraseMessageWire,
} from '@/frontend/lib/passphrase-message-crypto'

describe('passphrase-message-crypto', () => {
  it('roundtrip', async () => {
    const { wire, passphrase } = await encryptPassphraseMessage('Hallo Geheim')
    expect(isPassphraseMessageWire(wire)).toBe(true)
    expect(await decryptPassphraseMessageWire(wire, passphrase)).toBe('Hallo Geheim')
  })

  it('rejects wrong pass', async () => {
    const { wire } = await encryptPassphraseMessage('x')
    await expect(decryptPassphraseMessageWire(wire, 'falsch-geheim')).rejects.toThrow(/Passphrase|falsch/i)
  })

  it('gleiche Passphrase: zwei Wires, beide entschlüsselbar', async () => {
    const pass = 'reuse-pass-8888'
    const a = await encryptPassphraseMessage('eins', pass)
    const b = await encryptPassphraseMessage('zwei', pass)
    expect(a.passphrase).toBe(pass)
    expect(b.passphrase).toBe(pass)
    expect(a.wire).not.toBe(b.wire)
    expect(await decryptPassphraseMessageWire(a.wire, pass)).toBe('eins')
    expect(await decryptPassphraseMessageWire(b.wire, pass)).toBe('zwei')
  })
})
