import { describe, expect, it } from 'vitest'
import { encodeIotaCompactFitChain } from './iota-compact-encode-policy'
import { VAULT_IMAGE_SHA256_LEN } from './vault-image-format'

const sha = new Uint8Array(VAULT_IMAGE_SHA256_LEN).fill(0xab)

describe('encodeIotaCompactFitChain', () => {
  it('wählt erstes Preset unter Budget', async () => {
    const r = await encodeIotaCompactFitChain(
      sha,
      {
        encodeChroma: async () => new Uint8Array(40),
        encodeLuma: async () => new Uint8Array(200),
      },
      11_800
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.result.plaintext.length).toBeLessThanOrEqual(11_800)
      expect(r.result.lumaWebpBytes).toBe(200)
      expect(r.result.chromaPngBytes).toBe(40)
    }
  })

  it('Fehler wenn nichts passt', async () => {
    const r = await encodeIotaCompactFitChain(
      sha,
      {
        encodeChroma: async () => new Uint8Array(9000),
        encodeLuma: async () => new Uint8Array(9000),
      },
      500
    )
    expect(r.ok).toBe(false)
  })
})
