import { describe, expect, it } from 'vitest'
import { buildEinsatzManifestV1 } from './einsatz-manifest-v1'
import { verifyEinsatzManifestV1 } from './einsatz-manifest-verify'
import type { Message } from '@/frontend/lib/types'

const PKG = '0x' + 'a'.repeat(64)

describe('einsatz-manifest-verify', () => {
  it('validiert gebautes Manifest', async () => {
    const manifest = await buildEinsatzManifestV1({
      einsatzId: 'demo',
      packageId: PKG,
      chainMode: 'mainnet-direct',
      messages: [
        { id: '1', from: '0x' + 'b'.repeat(64), content: 'x', timestamp: 1, encrypted: false },
      ] as Message[],
      sequence: 1,
    })
    const r = await verifyEinsatzManifestV1(manifest)
    expect(r.ok).toBe(true)
  })

  it('lehnt manipulierten Hash ab', async () => {
    const manifest = await buildEinsatzManifestV1({
      einsatzId: 'demo',
      packageId: PKG,
      chainMode: 'mainnet-direct',
      messages: [],
      sequence: 0,
    })
    manifest.manifest_hash = '0'.repeat(64)
    const r = await verifyEinsatzManifestV1(manifest)
    expect(r.ok).toBe(false)
  })
})
