import { describe, expect, it, vi } from 'vitest'
import type { IotaClient } from '@iota/iota-sdk/client'
import { probeDirectIotaRpc } from './chain-reachability'

describe('probeDirectIotaRpc', () => {
  it('returns true when getRpcApiVersion succeeds', async () => {
    const client = {
      getRpcApiVersion: vi.fn().mockResolvedValue({ version: '1' }),
    } as unknown as IotaClient
    await expect(probeDirectIotaRpc(client)).resolves.toBe(true)
  })

  it('returns false when getRpcApiVersion throws', async () => {
    const client = {
      getRpcApiVersion: vi.fn().mockRejectedValue(new Error('offline')),
    } as unknown as IotaClient
    await expect(probeDirectIotaRpc(client)).resolves.toBe(false)
  })
})
