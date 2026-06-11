/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import {
  decryptHandoffPending,
  extractHandoffFromZipBytes,
  extractHandoffFromZipFile,
} from '@/frontend/lib/handoff-zip-import'
import { encryptHandoffEnvUtf8, HANDOFF_CRYPTO_JSON_FILENAME, HANDOFF_ENV_ENC_FILENAME } from '@/frontend/lib/handoff-zip-crypto'

function makeZipBytes(files: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))
}

describe('extractHandoffFromZipFile', () => {
  it('findet morgendrot-standalone-handoff.env in ZIP-Bytes', () => {
    const zipBytes = makeZipBytes({
      'morgendrot-standalone-handoff.env': 'ROLE=arbeiter\nPACKAGE_ID=0x' + 'a'.repeat(64),
      'README-HANDOFF.txt': 'PSK Hinweis',
    })
    const r = extractHandoffFromZipBytes(zipBytes)
    if (!r.ok || 'needsPassword' in r) throw new Error(`extract failed`)
    if (!r.ok || 'needsPassword' in r) throw new Error('expected plaintext zip')
    expect(r.envText).toContain('ROLE=arbeiter')
    expect(r.readmeText).toContain('PSK')
  })

  it('erkennt verschlüsseltes ZIP und entschlüsselt mit Passwort', async () => {
    const plain = 'ROLE=messenger\nSIMPLE_MODE=true\n'
    const { meta, ciphertext } = await encryptHandoffEnvUtf8(plain, 'test-pass-123456')
    const zipBytes2 = zipSync({
      [HANDOFF_ENV_ENC_FILENAME]: ciphertext,
      [HANDOFF_CRYPTO_JSON_FILENAME]: strToU8(JSON.stringify(meta)),
      'README-HANDOFF.txt': strToU8('verschlüsselt'),
    })
    const first = extractHandoffFromZipBytes(zipBytes2)
    expect('needsPassword' in first && first.needsPassword).toBe(true)
    if (!('needsPassword' in first) || !first.needsPassword) throw new Error('expected needsPassword')
    const dec = await decryptHandoffPending(first.pending, 'test-pass-123456')
    expect(dec.ok).toBe(true)
    if (dec.ok) expect(dec.envText).toBe(plain)
  })

  it('lehnt Nicht-ZIP ab', async () => {
    const file = new File(['x'], 'handoff.txt', { type: 'text/plain' })
    const r = await extractHandoffFromZipFile(file)
    expect(r.ok).toBe(false)
    if (!r.ok && 'error' in r) expect(r.error).toMatch(/\.zip/)
  })
})
