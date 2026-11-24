import { describe, expect, it } from 'vitest'
import {
  buildPhaseSegmentWires,
  FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES,
  FLUENT_LORA_MAX_SEGMENTS_PER_PHASE,
  isFluentLoraImageValidationError,
  planFluentLoraImage,
  segmentCountForJpeg,
} from '@/frontend/features/send/lora-image-morg-seg-v1-policy'
import { MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES } from '@/frontend/lib/lora-sarq-wire'
import { MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES, wireUtf8ByteLength } from '@/frontend/lib/compact-image-wire'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import { uint8ArrayToBase64 } from '@/frontend/lib/emergency-binary-browser'

function miniJpegWire(kind: 'luma' | 'chroma', msgId: string, byteLen: number): string {
  const jpeg = new Uint8Array(byteLen)
  jpeg[0] = 0xff
  jpeg[1] = 0xd8
  const b64 = uint8ArrayToBase64(jpeg)
  const prefix = kind === 'luma' ? '[[MORG_LUMA_V1:' : '[[MORG_CHROMA_V1:'
  return `${prefix}msgId=${msgId}|len=${b64.length}|${b64}]]`
}

describe('buildPhaseSegmentWires', () => {
  it('lehnt mehr als 32 Segmente pro Phase ab', () => {
    const jpeg = new Uint8Array((FLUENT_LORA_MAX_SEGMENTS_PER_PHASE + 1) * MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES)
    const r = buildPhaseSegmentWires('luma', 'aabbccdd', jpeg)
    expect(isFluentLoraImageValidationError(r)).toBe(true)
    if (!isFluentLoraImageValidationError(r)) return
    expect(r.message).toMatch(/32/)
  })
})

describe('segmentCountForJpeg', () => {
  it('ceil division', () => {
    expect(segmentCountForJpeg(1, 100)).toBe(1)
    expect(segmentCountForJpeg(101, 100)).toBe(2)
  })
})

describe('planFluentLoraImage', () => {
  it('accepts small image under pair cap', () => {
    const attached: ChatAttachedLora = {
      lumaWire: miniJpegWire('luma', 'aabbccdd', 1400),
      chromaWire: miniJpegWire('chroma', 'aabbccdd', 600),
      messageId: 'aabbccdd',
      lumaJpegBytes: 1400,
      chromaJpegBytes: 600,
    }
    const r = planFluentLoraImage(attached)
    expect('luma' in r).toBe(true)
    if (!('luma' in r)) return
    expect(r.totalBytes).toBe(2000)
    expect(r.totalBytes).toBeLessThanOrEqual(FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES)
    expect(FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES).toBe(3600)
    expect(r.luma.n).toBeGreaterThan(0)
    expect(r.chroma.n).toBeGreaterThan(0)
    expect(r.luma.n + r.chroma.n).toBeLessThanOrEqual(FLUENT_LORA_MAX_SEGMENTS_PER_PHASE * 2)
    for (const w of [...r.luma.wires, ...r.chroma.wires]) {
      expect(w.length).toBeGreaterThan(20)
      expect(wireUtf8ByteLength(w)).toBeLessThanOrEqual(MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES)
    }
  })

  it('rejects over pair cap total', () => {
    const half = Math.floor(FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES / 2) + 100
    const attached: ChatAttachedLora = {
      lumaWire: miniJpegWire('luma', '11223344', half),
      chromaWire: miniJpegWire('chroma', '11223344', half),
      messageId: '11223344',
      lumaJpegBytes: half,
      chromaJpegBytes: half,
    }
    const r = planFluentLoraImage(attached)
    expect('ok' in r && r.ok === false).toBe(true)
    if (!('ok' in r) || r.ok !== false) return
    expect(r.message).toMatch(/KB/)
  })
})
