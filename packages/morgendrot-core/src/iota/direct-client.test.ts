import { describe, expect, it, vi } from 'vitest'
import { createDirectIotaClient } from './direct-client'

describe('createDirectIotaClient', () => {
  it('returns an IotaClient wired to the sanitized URL (fetch injectable)', () => {
    const fetchImpl = vi.fn()
    const client = createDirectIotaClient({
      rpcUrl: '  https://api.testnet.iota.cafe  ',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(client).toBeTruthy()
    expect(typeof client.getRpcApiVersion).toBe('function')
    // Transport defers fetch until first RPC — no call at construction.
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
