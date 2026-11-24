import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import {
  classifySegSendResult,
  collectMissingFromNaks,
  peerReportedPhaseComplete,
  sendLoraImageViaMorgSegV1,
} from './lora-image-morg-seg-v1-send'
import { parseMorgSegV1Message } from '@/frontend/lib/lora-sarq-parser'
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
    chromaWire: miniJpegWire('chroma', 'aabbccdd', 400),
    messageId: 'aabbccdd',
    lumaJpegBytes: 400,
    chromaJpegBytes: 400,
  }
}

function ack(phase: 'luma' | 'chroma') {
  return buildMorgNakV1Wire({ msgId: 'aabbccdd', phase, mask: 0 })
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

  it('Luma ohne Peer-Signal: kein Blind-Voll-Resend, soft weiter zu Chroma', async () => {
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
    const luma = sent.filter((w) => w.includes('phase=luma') && w.includes('MORG_SEG_V1'))
    const chroma = sent.filter((w) => w.includes('phase=chroma') && w.includes('MORG_SEG_V1'))
    expect(luma.length).toBeGreaterThan(0)
    expect(chroma.length).toBeGreaterThan(0)
    /** Ohne NAK/Rate-Limit: genau 1× jedes Luma-Segment, nicht 2× Vollphase. */
    const bySeg = new Map<number, number>()
    for (const w of luma) {
      const p = parseMorgSegV1Message(w)
      if (!p) continue
      bySeg.set(p.seg, (bySeg.get(p.seg) ?? 0) + 1)
    }
    for (const c of bySeg.values()) expect(c).toBe(1)
  })

  it('classifySegSendResult: Rate-Limit vs Soft vs ok', () => {
    expect(classifySegSendResult({ id: 1, rateLimit: true, error: 38 })).toBe('rate_limit')
    expect(classifySegSendResult({ id: 1, softRouting: true })).toBe('soft')
    /** Soft gewinnt gegen nacktes error:38 — sonst Voll-Repair-Illusion. */
    expect(classifySegSendResult({ id: 1, softRouting: true, error: 38 })).toBe('soft')
    expect(classifySegSendResult({ id: 1, error: 38 })).toBe('rate_limit')
    expect(classifySegSendResult({ id: 9 })).toBe('ok')
  })

  it('Rate-Limit: nur betroffene Segmente gezielt nachsenden (nicht Vollphase)', async () => {
    const sentSegs: number[] = []
    let lumaAttempts = 0
    const run = sendLoraImageViaMorgSegV1({
      attached: mockAttached(),
      dest: 'broadcast',
      meshtastic: { connected: true } as never,
      throwIfCancelled: () => {},
      onProgress: () => {},
      onStatusMsg: () => {},
      drainInboundMeshText: () => [ack('luma')],
      sendMeshText: async (text) => {
        const p = parseMorgSegV1Message(text)
        if (!p || p.phase !== 'luma') return { id: 1 }
        lumaAttempts++
        sentSegs.push(p.seg)
        /** Erster Versuch Segment 1 → Rate-Limit; danach ok. */
        if (p.seg === 1 && sentSegs.filter((s) => s === 1).length === 1) {
          return { id: 0, rateLimit: true, error: 38, soft: true }
        }
        return { id: lumaAttempts }
      },
    })
    await vi.runAllTimersAsync()
    const r = await run
    expect(r.ok).toBe(true)
    const ones = sentSegs.filter((s) => s === 1)
    expect(ones.length).toBeGreaterThanOrEqual(2)
    expect(ones.length).toBeLessThanOrEqual(3)
    /** Andere Segmente nicht massenhaft wiederholt. */
    for (const seg of new Set(sentSegs)) {
      if (seg === 1) continue
      expect(sentSegs.filter((s) => s === seg).length).toBe(1)
    }
  })

  it('mit Luma mask=0 → Chroma; Stille bei Chroma OK', async () => {
    const sent: string[] = []
    let drains = 0
    const run = sendLoraImageViaMorgSegV1({
      attached: mockAttached(),
      dest: 'broadcast',
      meshtastic: { connected: true } as never,
      throwIfCancelled: () => {},
      onProgress: () => {},
      onStatusMsg: () => {},
      drainInboundMeshText: () => {
        drains++
        if (drains >= 3) return [ack('luma')]
        return []
      },
      sendMeshText: async (text) => {
        sent.push(text)
      },
    })
    await vi.runAllTimersAsync()
    const r = await run
    expect(r.ok).toBe(true)
    expect(sent.some((w) => w.includes('phase=luma') && w.includes('MORG_SEG_V1'))).toBe(true)
    expect(sent.some((w) => w.includes('phase=chroma') && w.includes('MORG_SEG_V1'))).toBe(true)
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

  it('peerReportedPhaseComplete erkennt mask=0', () => {
    expect(peerReportedPhaseComplete([ack('luma')], 'aabbccdd', 'luma')).toBe(true)
    expect(peerReportedPhaseComplete([ack('chroma')], 'aabbccdd', 'luma')).toBe(false)
  })

  it('sendet Segment nach Lücken-NAK erneut, dann ACK', async () => {
    const sent: string[] = []
    let drainCalls = 0
    const drainInboundMeshText = vi.fn(() => {
      drainCalls++
      if (drainCalls === 8) {
        return [
          buildMorgNakV1Wire({
            msgId: 'aabbccdd',
            phase: 'luma',
            mask: nakMaskFromMissingIndices([0]),
          }),
        ]
      }
      if (drainCalls >= 20) return [ack('luma')]
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
  it('ignoriert falsche msgId/phase und mask=0', () => {
    const nak = buildMorgNakV1Wire({
      msgId: 'deadbeef',
      phase: 'chroma',
      mask: nakMaskFromMissingIndices([1]),
    })
    expect(collectMissingFromNaks([nak], 'aabbccdd', 'luma', 3)).toEqual([])
    expect(collectMissingFromNaks([ack('luma')], 'aabbccdd', 'luma', 3)).toEqual([])
  })
})
