import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/frontend/lib/api', () => ({
  meshBuildV2Wires: vi.fn(),
}))

import { meshBuildV2Wires } from '@/frontend/lib/api'
import { sendMeshV2WireBurst } from './chat-view-mesh-send'

const meshBuild = vi.mocked(meshBuildV2Wires)

describe('sendMeshV2WireBurst', () => {
  beforeEach(() => {
    meshBuild.mockReset()
  })

  it('sendet jedes Wire als Broadcast und meldet Fortschritt', async () => {
    meshBuild.mockResolvedValue({
      ok: true,
      wires: [
        { recipient: '', wireBase64: btoa('x'), meshNonce: 1 },
        { recipient: '', wireBase64: btoa('y'), meshNonce: 2 },
      ],
    })
    const sendBinaryV2 = vi.fn().mockResolvedValue(undefined)
    const onProgress = vi.fn()
    await sendMeshV2WireBurst('hi', sendBinaryV2, onProgress, { interPacketDelayMs: 0 })
    expect(meshBuild).toHaveBeenCalledWith('hi')
    expect(sendBinaryV2).toHaveBeenCalledTimes(2)
    expect(sendBinaryV2).toHaveBeenNthCalledWith(1, expect.any(Uint8Array), 'broadcast')
    expect(sendBinaryV2).toHaveBeenNthCalledWith(2, expect.any(Uint8Array), 'broadcast')
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ])
  })

  it('wirft bei fehlgeschlagenem Mesh-Build', async () => {
    meshBuild.mockResolvedValue({ ok: false, error: 'kaputt' })
    await expect(
      sendMeshV2WireBurst('x', vi.fn().mockResolvedValue(undefined), undefined, { interPacketDelayMs: 0 })
    ).rejects.toThrow('kaputt')
  })

  it('wirft wenn keine Wires geliefert werden', async () => {
    meshBuild.mockResolvedValue({ ok: true, wires: [] })
    await expect(
      sendMeshV2WireBurst('x', vi.fn().mockResolvedValue(undefined), undefined, { interPacketDelayMs: 0 })
    ).rejects.toThrow('Mesh-Build fehlgeschlagen')
  })
})
