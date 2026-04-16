import { describe, expect, it } from 'vitest'
import { isAddressMeshVerifiedInDirectory, isMeshEntryVerified } from './mesh-contact-verify'

const ADDR = `0x${'a'.repeat(64)}`

describe('mesh-contact-verify', () => {
  it('isMeshEntryVerified: beide Felder nicht leer', () => {
    expect(isMeshEntryVerified(undefined)).toBe(false)
    expect(isMeshEntryVerified({})).toBe(false)
    expect(isMeshEntryVerified({ meshNodeId: '!abc', meshPublicKeyHex: '' })).toBe(false)
    expect(isMeshEntryVerified({ meshNodeId: '', meshPublicKeyHex: '00' })).toBe(false)
    expect(isMeshEntryVerified({ meshNodeId: ' !x ', meshPublicKeyHex: '  ab ' })).toBe(true)
  })

  it('isAddressMeshVerifiedInDirectory: nur gültige 0x-Adresse', () => {
    const dir = {
      [ADDR]: { meshNodeId: 'n', meshPublicKeyHex: 'pk' },
    }
    expect(isAddressMeshVerifiedInDirectory(dir, ADDR)).toBe(true)
    expect(isAddressMeshVerifiedInDirectory(dir, ADDR.toUpperCase())).toBe(true)
    expect(isAddressMeshVerifiedInDirectory(dir, '  ' + ADDR + '  ')).toBe(true)
    expect(isAddressMeshVerifiedInDirectory(dir, `0x${'b'.repeat(63)}`)).toBe(false)
    expect(isAddressMeshVerifiedInDirectory(dir, 'not-hex')).toBe(false)
    expect(isAddressMeshVerifiedInDirectory({}, ADDR)).toBe(false)
  })
})
