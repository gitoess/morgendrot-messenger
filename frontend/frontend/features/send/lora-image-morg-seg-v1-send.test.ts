import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { collectMissingFromNaks, sendLoraImageViaMorgSegV1 } from './lora-image-morg-seg-v1-send'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import { uint8ArrayToBase64 } from '@/frontend/lib/emergency-binary-browser'
import { buildMorgNakV1Wire, nakMaskFromMissingIndices } from '@/frontend/lib/lora-sarq-wire'

function miniJpegWire(kind: 'luma' | 'chroma', msgId: string, byteLen: number): string {
  const jpeg = new Uint8Array(byteLen)
  jpeg[0] = 0xff
  jpeg[1] = 0xd8
  const b64 = uint8ArrayToBase64(jpeg)
  const prefix = kind === 'luma' ? '[[MORG_LUMA_V1:' : '[[MORG_CHROMA_V1:'
  return `${prefix}msgId=${msgId}|len=${b64.length}|${b64}]]`
}

function mockAttached(): ChatAttachedLora {
  return {
    lumaWire: miniJpegWire('luma', 'aabbccdd', 400),
    chromaWire: miniJpegWire('chroma', 'cafebabe', 400),
    messageId: 'aabbccdd',
    lumaJpegBytes: 400,
    chromaJpegBytes: 400,
  }
}

describe('sendLoraImageViaMorgSegV1 (H.25a)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('lehnt ab ohne Mesh-Verbindung', async () => {
    const r = await sendLoraImageViaMorgSegV1({
      attached: mockAttached(),
      dest: 'broadcast',
      meshtastic: { connected: false } as never,
      throwIfCancelled: () => {},
      onProgress: () => {},
      onStatusMsg: () => {},
      drainInboundMeshText: () => [],
      sendMeshText: vi.fn(),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/nicht verbunden/i)
  })

  it('sendet INIT vor Segmenten je Phase', async () => {
    const sent: string[] = []
    const run = sendLoraImageViaMorgSegV1({
      attached: mockAttached(),
      dest: 'broadcast',
      meshtastic: { connected: true } as never,
      throwIfCancelled: () => {},
      onProgress: () => {},
      onStatusMsg: () => {},
      drainInboundMeshText: () => [],
      sendMeshText: async (text) => {
        sent.push(text)
      },
    })
    await vi.runAllTimersAsync()
    const r = await run
    expect(r.ok).toBe(true)
    const inits = sent.filter((w) => w.includes('MORG_IMG_INIT_V1'))
    expect(inits.length).toBeGreaterThanOrEqual(2)
    expect(sent.some((w) => w.includes('MORG_SEG_V1'))).toBe(true)
  })

  it('collectMissingFromNaks: parst NAK-Maske', () => {
    const nak = buildMorgNakV1Wire({
      msgId: 'aabbccdd',
      phase: 'luma',
      mask: nakMaskFromMissingIndices([0, 2]),
    })
    const missing = collectMissingFromNaks([nak], 'aabbccdd', 'luma', 4)
    expect(missing).toEqual([0, 2])
  })

  it('sendet Segment nach NAK erneut (Luma)', async () => {
    const sent: string[] = []
    let lumaNakRound = 0
    const drainInboundMeshText = vi.fn(() => {
      if (lumaNakRound === 0) {
        lumaNakRound++
        return [
          buildMorgNakV1Wire({
            msgId: 'aabbccdd',
            phase: 'luma',
            mask: nakMaskFromMissingIndices([0]),
          }),
        ]
      }
      return []
    })

    const run = sendLoraImageViaMorgSegV1({
      attached: mockAttached(),
      dest: 'broadcast',
      meshtastic: { connected: true } as never,
      throwIfCancelled: () => {},
      onProgress: () => {},
      onStatusMsg: () => {},
      drainInboundMeshText,
      sendMeshText: async (text) => {
        sent.push(text)
      },
    })

    await vi.runAllTimersAsync()
    const r = await run
    expect(r.ok).toBe(true)
    const lumaSeg0 = sent.filter(
      (w) => w.includes('MORG_SEG_V1') && w.includes('phase=luma') && w.includes('|seg=0|')
    )
    expect(lumaSeg0.length).toBeGreaterThanOrEqual(2)
  })
})

describe('collectMissingFromNaks', () => {
  it('ignoriert falsche msgId/phase', () => {
    const nak = buildMorgNakV1Wire({
      msgId: 'deadbeef',
      phase: 'chroma',
      mask: nakMaskFromMissingIndices([1]),
    })
    expect(collectMissingFromNaks([nak], 'aabbccdd', 'luma', 3)).toEqual([])
  })
})
