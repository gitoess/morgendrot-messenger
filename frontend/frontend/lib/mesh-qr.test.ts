import { describe, expect, it } from 'vitest'
import { parseMeshBundleFromQrText } from './mesh-qr'

describe('parseMeshBundleFromQrText', () => {
  it('gültiges Bundle', () => {
    const raw = JSON.stringify({
      v: 1,
      salt: 's',
      iv: 'i',
      tag: 't',
      ciphertext: 'c',
    })
    expect(parseMeshBundleFromQrText(raw)).toEqual({
      v: 1,
      salt: 's',
      iv: 'i',
      tag: 't',
      ciphertext: 'c',
    })
  })

  it('trim um JSON', () => {
    const inner = JSON.stringify({ v: 1, salt: 'a', iv: 'b', tag: 'c', ciphertext: 'e' })
    expect(parseMeshBundleFromQrText(`  \n${inner}\t  `)).toEqual({
      v: 1,
      salt: 'a',
      iv: 'b',
      tag: 'c',
      ciphertext: 'e',
    })
  })

  it('null bei fehlendem Feld', () => {
    expect(parseMeshBundleFromQrText('{"v":1}')).toBeNull()
    expect(
      parseMeshBundleFromQrText(
        JSON.stringify({ v: 1, salt: '', iv: 'i', tag: 't', ciphertext: 'c' }),
      ),
    ).toBeNull()
  })

  it('null bei falschem v-Typ', () => {
    expect(
      parseMeshBundleFromQrText(
        JSON.stringify({ v: '1', salt: 's', iv: 'i', tag: 't', ciphertext: 'c' }),
      ),
    ).toBeNull()
  })

  it('null bei ungültigem JSON', () => {
    expect(parseMeshBundleFromQrText('not json')).toBeNull()
  })
})
