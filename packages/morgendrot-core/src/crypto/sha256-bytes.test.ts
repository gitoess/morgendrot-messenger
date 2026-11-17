import { describe, it, expect, vi, afterEach } from 'vitest'
import { sha256 as nobleSha256 } from '@noble/hashes/sha256'
import { sha256Bytes } from './sha256-bytes'

describe('sha256Bytes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fällt ohne crypto.subtle auf noble zurück', async () => {
    vi.stubGlobal('crypto', { subtle: undefined })
    const payload = new TextEncoder().encode('canonical')
    const got = await sha256Bytes(payload)
    expect([...got]).toEqual([...nobleSha256(payload)])
  })
})
