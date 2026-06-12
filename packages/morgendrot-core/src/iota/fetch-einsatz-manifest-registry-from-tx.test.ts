import { describe, expect, it, vi } from 'vitest'
import type { IotaClient } from '@iota/iota-sdk/client'
import { fetchEinsatzManifestRegistryIdFromDigest } from './fetch-einsatz-manifest-registry-from-tx'

const REG = '0x' + 'd'.repeat(64)

describe('fetchEinsatzManifestRegistryIdFromDigest', () => {
  it('liest registry_id aus Events', async () => {
    const client = {
      getTransactionBlock: vi.fn().mockResolvedValue({
        events: [
          {
            type: '0xpkg::messaging::EinsatzManifestRegistryCreated',
            parsedJson: { registry_id: REG },
          },
        ],
      }),
    } as unknown as IotaClient
    const id = await fetchEinsatzManifestRegistryIdFromDigest(client, 'digest1')
    expect(id).toBe(REG.toLowerCase())
  })
})
