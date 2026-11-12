import { describe, expect, it } from 'vitest'
import { isSha256Hex64, normalizeSha256Hex, sha256HexOfUtf8 } from '@/frontend/lib/content-sha256'

describe('content-sha256', () => {
  it('hashes utf8 stably', async () => {
    const h = await sha256HexOfUtf8('morgendrot')
    expect(h).toHaveLength(64)
    expect(await sha256HexOfUtf8('morgendrot')).toBe(h)
    expect(await sha256HexOfUtf8('other')).not.toBe(h)
  })

  it('normalizes expected hashes', () => {
    expect(normalizeSha256Hex(' 0xAb Cd\n')).toBe('abcd')
    expect(isSha256Hex64('a'.repeat(64))).toBe(true)
    expect(isSha256Hex64('zz')).toBe(false)
  })
})
