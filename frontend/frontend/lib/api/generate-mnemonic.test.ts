import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/frontend/lib/api/api-base', () => ({
  getApiBase: vi.fn(() => ''),
}))

vi.mock('@/frontend/lib/generate-mnemonic-local', () => ({
  generateMnemonicKeypairLocally: vi.fn(() => ({
    ok: true,
    address: '0x' + 'e'.repeat(64),
    secretKey: 'local-secret',
  })),
}))

import { getApiBase } from '@/frontend/lib/api/api-base'
import { generateMnemonicKeypairLocally } from '@/frontend/lib/generate-mnemonic-local'
import { fetchGenerateMnemonic } from '@/frontend/lib/api/generate-mnemonic'

describe('fetchGenerateMnemonic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getApiBase).mockReturnValue('')
    global.fetch = vi.fn()
  })

  it('nutzt lokalen Generator ohne Basis-URL', async () => {
    const r = await fetchGenerateMnemonic()
    expect(generateMnemonicKeypairLocally).toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(r).toEqual({
      ok: true,
      address: '0x' + 'e'.repeat(64),
      secretKey: 'local-secret',
    })
  })

  it('ruft Server wenn Basis-URL gesetzt', async () => {
    vi.mocked(getApiBase).mockReturnValue('http://127.0.0.1:3342')
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        address: '0x' + 'f'.repeat(64),
        secretKey: 'server-secret',
      }),
    } as Response)

    const r = await fetchGenerateMnemonic()
    expect(generateMnemonicKeypairLocally).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3342/api/generate-mnemonic',
      expect.objectContaining({ method: 'POST' })
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.secretKey).toBe('server-secret')
  })
})
