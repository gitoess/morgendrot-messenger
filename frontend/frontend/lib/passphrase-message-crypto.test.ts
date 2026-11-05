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
})
