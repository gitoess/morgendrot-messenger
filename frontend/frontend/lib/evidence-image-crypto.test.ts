import { describe, expect, it } from 'vitest'
import {
  decryptEvidenceImageBytes,
  encryptEvidenceImageBytes,
  generateEvidenceImageSharePassphrase,
  isEvidenceImageEncryptedBlob,
} from '@/frontend/lib/evidence-image-crypto'

describe('evidence-image-crypto', () => {
  it('roundtrip PNG bytes', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
    const pass = generateEvidenceImageSharePassphrase()
    const { blob } = await encryptEvidenceImageBytes(png, pass, 'image/png')
    expect(isEvidenceImageEncryptedBlob(blob)).toBe(true)
    const dec = await decryptEvidenceImageBytes(blob, pass)
    expect(dec.contentType).toBe('image/png')
    expect(Array.from(dec.bytes)).toEqual(Array.from(png))
  })

  it('rejects wrong passphrase', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const { blob } = await encryptEvidenceImageBytes(png, 'richtig-geheim-12', 'image/png')
    await expect(decryptEvidenceImageBytes(blob, 'falsch-geheim-99')).rejects.toThrow(/Passphrase|falsch/i)
  })
})
