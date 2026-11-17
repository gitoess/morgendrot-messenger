import { describe, it, expect, vi, afterEach } from 'vitest'
import { sha256 as nobleSha256 } from '@noble/hashes/sha256'
import { sha256HexOfBytes } from '@/frontend/lib/sha256-bytes'

function toHex(u8: Uint8Array): string {
  return [...u8].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('sha256-bytes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hash ohne crypto.subtle (LAN-HTTP) = noble', async () => {
    vi.stubGlobal('crypto', { subtle: undefined })
    const payload = new TextEncoder().encode('morgendrot')
    const hex = await sha256HexOfBytes(payload)
    expect(hex).toBe(toHex(nobleSha256(payload)))
  })

  it('ist deterministisch', async () => {
    const a = await sha256HexOfBytes(new TextEncoder().encode('x'))
    const b = await sha256HexOfBytes(new TextEncoder().encode('x'))
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
})
