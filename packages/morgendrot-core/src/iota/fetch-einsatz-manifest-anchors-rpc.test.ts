import { describe, expect, it, vi } from 'vitest'
import type { IotaClient } from '@iota/iota-sdk/client'
import { fetchEinsatzManifestAnchorsForEinsatz } from './fetch-einsatz-manifest-anchors-rpc'

const PKG = '0x' + 'a'.repeat(64)
const REG = '0x' + 'b'.repeat(64)
const EINSATZ = '0x' + 'c'.repeat(64)
const ANCHOR_OBJ = '0x' + 'd'.repeat(64)

describe('fetchEinsatzManifestAnchorsForEinsatz', () => {
  it('listet Anker für einsatz_id', async () => {
    const client = {
      getDynamicFields: vi.fn().mockResolvedValue({
        data: [
          {
            objectId: ANCHOR_OBJ,
            name: {
              type: `${PKG}::messaging::EinsatzManifestKey`,
              value: { einsatz_id: EINSATZ, sequence: '2' },
            },
          },
        ],
      }),
      multiGetObjects: vi.fn().mockResolvedValue([
        {
          data: {
            content: {
              fields: {
                sequence: '2',
                manifest_hash: Array.from({ length: 32 }, (_, i) => i),
                merkle_root: Array.from({ length: 32 }, (_, i) => 31 - i),
                source_network: 1,
                message_count: '5',
                anchored_at_ms: '1700000000000',
              },
            },
          },
        },
      ]),
    } as unknown as IotaClient

    const rows = await fetchEinsatzManifestAnchorsForEinsatz(client, {
      packageId: PKG,
      registryObjectId: REG,
      einsatzIdMoveAddress: EINSATZ,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.sequence).toBe(2)
    expect(rows[0]?.messageCount).toBe(5)
    expect(rows[0]?.manifestHashHex).toHaveLength(64)
  })
})
