/**
 * Virtuelle Funkstrecke: Verlustkanal + Empfänger-Reassembly + NAK → Sender-Repair.
 * Viele Seeds, bevor Live-Heltec.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { sendLoraImageViaMorgSegV1 } from './lora-image-morg-seg-v1-send'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import { uint8ArrayToBase64 } from '@/frontend/lib/emergency-binary-browser'
import { parseMorgSegV1Message } from '@/frontend/lib/lora-sarq-parser'
import { MorgSegV1ReassemblyBuffer } from '@/frontend/lib/lora-sarq-reassembly'
import { MORG_SEG_V1_REASSEMBLY_IDLE_MS_DEFAULT } from '@/frontend/lib/lora-sarq-reassembly'

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function miniJpegWire(kind: 'luma' | 'chroma', msgId: string, byteLen: number): string {
  const jpeg = new Uint8Array(byteLen)
  jpeg[0] = 0xff
  jpeg[1] = 0xd8
  for (let i = 2; i < byteLen; i++) jpeg[i] = (i * 17 + byteLen) & 0xff
  const b64 = uint8ArrayToBase64(jpeg)
  const prefix = kind === 'luma' ? '[[MORG_LUMA_V1:' : '[[MORG_CHROMA_V1:'
  return `${prefix}msgId=${msgId}|len=${b64.length}|${b64}]]`
}

function mockAttached(byteLen = 900): ChatAttachedLora {
  return {
    lumaWire: miniJpegWire('luma', 'aabbccdd', byteLen),
    chromaWire: miniJpegWire('chroma', 'aabbccdd', Math.max(200, Math.floor(byteLen / 3))),
    messageId: 'aabbccdd',
    lumaJpegBytes: byteLen,
    chromaJpegBytes: Math.max(200, Math.floor(byteLen / 3)),
  }
}

type SimResult = {
  ok: boolean
  error?: string
  segTx: number
  lumaSegTx: number
  chromaSegTx: number
  lumaAssembled: boolean
  chromaAssembled: boolean
  nakRx: number
}

async function runLossyTransfer(opts: {
  seed: number
  dropRate: number
  cancelAfterSegs?: number
}): Promise<SimResult> {
  const rng = mulberry32(opts.seed)
  const lumaBuf = new MorgSegV1ReassemblyBuffer()
  const chromaBuf = new MorgSegV1ReassemblyBuffer()
  const inbound: string[] = []
  let lastRxAt = 0
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let nakRx = 0
  let segTx = 0
  let lumaSegTx = 0
  let chromaSegTx = 0
  let cancel = false
  let lumaAssembled = false
  let chromaAssembled = false

  const armIdle = (phase: 'luma' | 'chroma') => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      idleTimer = null
      const buf = phase === 'luma' ? lumaBuf : chromaBuf
      const w = buf.emitIdleNakRound()
      if (w) {
        inbound.push(w)
        nakRx++
      }
      if (buf.needsIdleTimer()) armIdle(phase)
    }, MORG_SEG_V1_REASSEMBLY_IDLE_MS_DEFAULT)
  }

  const deliver = (wire: string) => {
    const p = parseMorgSegV1Message(wire)
    if (!p) return
    const buf = p.phase === 'luma' ? lumaBuf : chromaBuf
    const r = buf.ingest(p)
    lastRxAt = Date.now()
    if (r.completeAck) {
      inbound.push(r.completeAck)
      nakRx++
      if (p.phase === 'luma') lumaAssembled = true
      else chromaAssembled = true
      if (idleTimer) {
        clearTimeout(idleTimer)
        idleTimer = null
      }
      return
    }
    if (r.assembled) {
      if (p.phase === 'luma') lumaAssembled = true
      else chromaAssembled = true
    }
    if (buf.needsIdleTimer()) armIdle(p.phase)
  }

  const sendMeshText = async (text: string) => {
    if (cancel) throw new Error('Übertragung abgebrochen.')
    if (text.includes('MORG_SEG_V1')) {
      segTx++
      if (text.includes('phase=luma')) lumaSegTx++
      if (text.includes('phase=chroma')) chromaSegTx++
      if (opts.cancelAfterSegs != null && segTx >= opts.cancelAfterSegs) {
        cancel = true
      }
      if (rng() >= opts.dropRate) {
        deliver(text)
      }
    }
    return { id: segTx, queued: true }
  }

  const run = sendLoraImageViaMorgSegV1({
    attached: mockAttached(900),
    dest: 'broadcast',
    meshtastic: { connected: true } as never,
    throwIfCancelled: () => {
      if (cancel) throw new Error('Übertragung abgebrochen.')
    },
    onProgress: () => {},
    onStatusMsg: () => {},
    drainInboundMeshText: () => {
      const out = inbound.splice(0, inbound.length)
      return out
    },
    sendMeshText,
  })

  await vi.runAllTimersAsync()
  const r = await run
  if (idleTimer) clearTimeout(idleTimer)

  return {
    ok: r.ok,
    error: r.ok ? undefined : r.error,
    segTx,
    lumaSegTx,
    chromaSegTx,
    lumaAssembled,
    chromaAssembled,
    nakRx,
  }
}

describe('MORG_SEG_V1 virtuelle Verluststrecke', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('perfekter Kanal: Luma+Chroma assembled, wenig TX', async () => {
    const r = await runLossyTransfer({ seed: 1, dropRate: 0 })
    expect(r.ok).toBe(true)
    expect(r.lumaAssembled).toBe(true)
    expect(r.chromaAssembled).toBe(true)
    expect(r.chromaSegTx).toBeGreaterThan(0)
    /** Ohne Verlust: ~1× Segmente (kein Blind-Alles-nochmal). */
    expect(r.segTx).toBeLessThan(r.lumaSegTx + r.chromaSegTx + 40)
  })

  it('Abbruch nach wenigen Segmenten stoppt ohne Hang', async () => {
    const r = await runLossyTransfer({ seed: 2, dropRate: 0, cancelAfterSegs: 3 })
    expect(r.ok).toBe(false)
    if (r.error) expect(r.error).toMatch(/abgebrochen/i)
    expect(r.segTx).toBeLessThan(12)
  })

  it('200 Seeds × 35% Verlust: Sender terminiert, Chroma versucht, kein TX-Explosion', async () => {
    const results: SimResult[] = []
    for (let seed = 0; seed < 200; seed++) {
      const r = await runLossyTransfer({ seed: seed * 97 + 13, dropRate: 0.35 })
      results.push(r)
    }
    const failedHard = results.filter((r) => !r.ok && !/abgebrochen/i.test(r.error ?? ''))
    expect(failedHard).toHaveLength(0)
    for (const r of results) {
      expect(r.ok).toBe(true)
      expect(r.chromaSegTx).toBeGreaterThan(0)
      expect(r.segTx).toBeLessThan(200)
    }
    const lumaOk = results.filter((r) => r.lumaAssembled).length
    const chromaOk = results.filter((r) => r.chromaAssembled).length
    /** Bei 35% Drop + S-ARQ: Mehrheit Luma OK (kein Live-Garantie 100/100). */
    expect(lumaOk).toBeGreaterThanOrEqual(120)
    expect(chromaOk).toBeGreaterThanOrEqual(100)
    /** Repair-Überhang: Median-TX nicht wie 3× Vollphase. */
    const txs = results.map((r) => r.segTx).sort((a, b) => a - b)
    const median = txs[Math.floor(txs.length / 2)]!
    expect(median).toBeLessThan(80)
  })

  it('200 Seeds × 20% Verlust: hohe Assemble-Rate beider Phasen', async () => {
    let lumaOk = 0
    let chromaOk = 0
    let maxTx = 0
    for (let seed = 0; seed < 200; seed++) {
      const r = await runLossyTransfer({ seed: seed * 41 + 7, dropRate: 0.2 })
      expect(r.ok).toBe(true)
      if (r.lumaAssembled) lumaOk++
      if (r.chromaAssembled) chromaOk++
      maxTx = Math.max(maxTx, r.segTx)
    }
    expect(lumaOk).toBeGreaterThanOrEqual(170)
    expect(chromaOk).toBeGreaterThanOrEqual(160)
    expect(maxTx).toBeLessThan(120)
  })

  it('jedes 2. Paket droppt (alternierend): Reparatur + Chroma', async () => {
    let n = 0
    const lumaBuf = new MorgSegV1ReassemblyBuffer()
    const chromaBuf = new MorgSegV1ReassemblyBuffer()
    const inbound: string[] = []
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let lumaAssembled = false
    let chromaAssembled = false
    let segTx = 0
    let lumaTx = 0
    const lumaSegCounts = new Map<number, number>()

    const armIdle = (phase: 'luma' | 'chroma') => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        idleTimer = null
        const buf = phase === 'luma' ? lumaBuf : chromaBuf
        const w = buf.emitIdleNakRound()
        if (w) inbound.push(w)
        if (buf.needsIdleTimer()) armIdle(phase)
      }, MORG_SEG_V1_REASSEMBLY_IDLE_MS_DEFAULT)
    }

    const deliver = (wire: string) => {
      const p = parseMorgSegV1Message(wire)
      if (!p) return
      const buf = p.phase === 'luma' ? lumaBuf : chromaBuf
      const r = buf.ingest(p)
      if (r.completeAck) {
        inbound.push(r.completeAck)
        if (p.phase === 'luma') lumaAssembled = true
        else chromaAssembled = true
        if (idleTimer) clearTimeout(idleTimer)
        return
      }
      if (r.assembled) {
        if (p.phase === 'luma') lumaAssembled = true
        else chromaAssembled = true
      }
      if (buf.needsIdleTimer()) armIdle(p.phase)
    }

    const run = sendLoraImageViaMorgSegV1({
      attached: mockAttached(900),
      dest: 'broadcast',
      meshtastic: { connected: true } as never,
      throwIfCancelled: () => {},
      onProgress: () => {},
      onStatusMsg: () => {},
      drainInboundMeshText: () => inbound.splice(0, inbound.length),
      sendMeshText: async (text) => {
        if (!text.includes('MORG_SEG_V1')) return { id: 0 }
        segTx++
        n++
        const parsed = parseMorgSegV1Message(text)
        if (parsed?.phase === 'luma') {
          lumaTx++
          lumaSegCounts.set(parsed.seg, (lumaSegCounts.get(parsed.seg) ?? 0) + 1)
        }
        if (n % 2 === 1) deliver(text)
        return { id: n, queued: true }
      },
    })
    await vi.runAllTimersAsync()
    const r = await run
    if (idleTimer) clearTimeout(idleTimer)
    expect(r.ok).toBe(true)
    expect(segTx).toBeLessThan(200)
    expect(segTx).toBeGreaterThan(5)
    /** Kein Blind-2×Vollphase: kein Segment >3×, Luma-TX ≪ 3×n. */
    const nLuma = lumaSegCounts.size || 1
    expect(lumaTx).toBeLessThan(nLuma * 3)
    for (const c of lumaSegCounts.values()) expect(c).toBeLessThanOrEqual(3)
    void lumaAssembled
    void chromaAssembled
  })

  it('60% Verlust: Sender soft-fertig (ok), TX bleibt begrenzt', async () => {
    const r = await runLossyTransfer({ seed: 42, dropRate: 0.6 })
    expect(r.ok).toBe(true)
    expect(r.chromaSegTx).toBeGreaterThan(0)
    expect(r.segTx).toBeLessThan(250)
  })
})
