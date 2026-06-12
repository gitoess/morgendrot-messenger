import { describe, expect, it, vi } from 'vitest'
import type { IotaClient } from '@iota/iota-sdk/client'
import { probeEinsatzManifestAnchorOnChain } from './einsatz-manifest-probe-rpc'

const PKG = '0x' + 'a'.repeat(64)
const REG = '0x' + 'b'.repeat(64)
const EINSATZ = '0x' + 'c'.repeat(64)

describe('probeEinsatzManifestAnchorOnChain', () => {
  it('true wenn Dynamic Field existiert', async () => {
    const client = {
      getDynamicFieldObject: vi.fn().mockResolvedValue({ data: { content: { fields: {} } } }),
    } as unknown as IotaClient
    const ok = await probeEinsatzManifestAnchorOnChain(client, {
      packageId: PKG,
      registryObjectId: REG,
      einsatzIdMoveAddress: EINSATZ,
      sequence: 1n,
    })
    expect(ok).toBe(true)
  })

  it('false bei RPC-Fehler', async () => {
    const client = {
      getDynamicFieldObject: vi.fn().mockRejectedValue(new Error('not found')),
    } as unknown as IotaClient
    const ok = await probeEinsatzManifestAnchorOnChain(client, {
      packageId: PKG,
      registryObjectId: REG,
      einsatzIdMoveAddress: EINSATZ,
      sequence: 2n,
    })
    expect(ok).toBe(false)
  })
})
