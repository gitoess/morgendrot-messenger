import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/frontend/lib/api', () => ({
  meshBuildV2Wires: vi.fn(),
}))

import { meshBuildV2Wires } from '@/frontend/lib/api'
import { MESH_V2_BURST_INTER_PACKET_MS_DEFAULT, sendMeshV2WireBurst } from './chat-view-mesh-send'

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

  it('ruft beforeEachPacket vor Build und vor jedem Paket auf', async () => {
    meshBuild.mockResolvedValue({
      ok: true,
      wires: [
        { recipient: '', wireBase64: btoa('a'), meshNonce: 1 },
        { recipient: '', wireBase64: btoa('b'), meshNonce: 2 },
      ],
    })
    const hook = vi.fn()
    const sendBinaryV2 = vi.fn().mockResolvedValue(undefined)
    await sendMeshV2WireBurst('hi', sendBinaryV2, undefined, {
      interPacketDelayMs: 0,
      beforeEachPacket: hook,
    })
    expect(hook).toHaveBeenCalledTimes(3)
  })

  it('wirft wenn keine Wires geliefert werden', async () => {
    meshBuild.mockResolvedValue({ ok: true, wires: [] })
    await expect(
      sendMeshV2WireBurst('x', vi.fn().mockResolvedValue(undefined), undefined, { interPacketDelayMs: 0 })
    ).rejects.toThrow('Mesh-Build fehlgeschlagen')
  })

  it('hält MESH_V2_BURST_INTER_PACKET_MS_DEFAULT zwischen zwei Paketen ein (Fake-Timer)', async () => {
    vi.useFakeTimers()
    try {
      meshBuild.mockResolvedValue({
        ok: true,
        wires: [
          { recipient: '', wireBase64: btoa('a'), meshNonce: 1 },
          { recipient: '', wireBase64: btoa('b'), meshNonce: 2 },
        ],
      })
      const sendBinaryV2 = vi.fn().mockResolvedValue(undefined)

      const burstPromise = sendMeshV2WireBurst('hi', sendBinaryV2)

      for (let n = 0; n < 20 && sendBinaryV2.mock.calls.length < 1; n++) {
        await Promise.resolve()
      }
      expect(sendBinaryV2).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(MESH_V2_BURST_INTER_PACKET_MS_DEFAULT - 1)
      expect(sendBinaryV2).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1)
      await burstPromise
      expect(sendBinaryV2).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('bei nur einem Wire kein Zwischen-Timer (auch mit Default-Intervall)', async () => {
    vi.useFakeTimers()
    try {
      meshBuild.mockResolvedValue({
        ok: true,
        wires: [{ recipient: '', wireBase64: btoa('x'), meshNonce: 1 }],
      })
      const sendBinaryV2 = vi.fn().mockResolvedValue(undefined)
      await sendMeshV2WireBurst('hi', sendBinaryV2)
      expect(sendBinaryV2).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
