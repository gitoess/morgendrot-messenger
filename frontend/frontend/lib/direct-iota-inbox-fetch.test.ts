import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { tryFetchDirectMailboxInboxViaIota } from '@/frontend/lib/direct-iota-inbox-fetch'
import { setIotaSubmitMode } from '@/frontend/lib/direct-iota-plain-submit'

describe('direct-iota-inbox-fetch', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    vi.stubGlobal(
      'window',
      {
        localStorage: {
          getItem: (k: string) => (k in store ? store[k] : null),
          setItem: (k: string, v: string) => {
            store[k] = v
          },
          removeItem: (k: string) => {
            delete store[k]
          },
          clear: () => {
            Object.keys(store).forEach((k) => delete store[k])
          },
          key: () => null,
          length: 0,
        } as Storage,
      } as Window & typeof globalThis
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('bricht bei Nur-API-Modus ab', async () => {
    setIotaSubmitMode('relay')
    const r = await tryFetchDirectMailboxInboxViaIota({ limit: 10, offset: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Nur Morgendrot-API/)
  })
})
