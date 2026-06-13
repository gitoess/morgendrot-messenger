/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { decryptHandoffEnvUtf8, encryptHandoffEnvUtf8, validateHandoffExportPassword } from '@/frontend/lib/handoff-zip-crypto'

describe('handoff-zip-crypto', () => {
  it('roundtrip env text', async () => {
    const plain = 'ROLE=arbeiter\nPACKAGE_ID=0x' + 'a'.repeat(64) + '\n'
    const { meta, ciphertext } = await encryptHandoffEnvUtf8(plain, 'feldtest-geheim-2026')
    const dec = await decryptHandoffEnvUtf8(meta, ciphertext, 'feldtest-geheim-2026')
    expect(dec.ok).toBe(true)
    if (dec.ok) expect(dec.envText).toBe(plain)
  })

  it('lehnt falsches Passwort ab', async () => {
    const { meta, ciphertext } = await encryptHandoffEnvUtf8('ROLE=messenger\n', 'correct')
    const dec = await decryptHandoffEnvUtf8(meta, ciphertext, 'wrong')
    expect(dec.ok).toBe(false)
  })

  it('validiert Export-Passwort', () => {
    expect(validateHandoffExportPassword('', '')).toMatch(/eingeben/)
    expect(validateHandoffExportPassword('short', 'short')).toMatch(/8 Zeichen/)
    expect(validateHandoffExportPassword('longenough', 'different')).toMatch(/überein/)
    expect(validateHandoffExportPassword('longenough', 'longenough')).toBeNull()
  })
})
