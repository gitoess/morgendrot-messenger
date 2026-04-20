import { describe, expect, it } from 'vitest'
import {
  MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES,
  buildMorgNakV1Wire,
  buildMorgSegV1Wire,
  computeMaxMorgSegV1RawPayloadBytes,
  crc16CcittFalse,
  missingIndicesFromNakMask,
  nakMaskFromMissingIndices,
} from '@/frontend/lib/lora-sarq-wire'
import { MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES, wireUtf8ByteLength } from '@/frontend/lib/compact-image-wire'

describe('crc16CcittFalse', () => {
  it('ASCII 123456789 → 0x29B1 (CRC-16/CCITT-FALSE)', () => {
    const u = new TextEncoder().encode('123456789')
    expect(crc16CcittFalse(u)).toBe(0x29b1)
  })

  it('leere Nutzlast', () => {
    expect(crc16CcittFalse(new Uint8Array(0))).toBe(0xffff)
  })
})

describe('NAK-Maske', () => {
  it('fehlende Indizes 3 und 7 → Bits gesetzt', () => {
    const m = nakMaskFromMissingIndices([3, 7])
    expect(m.toString(16)).toBe('88') // 0b10001000
    expect(missingIndicesFromNakMask(m, 16)).toEqual([3, 7])
  })

  it('buildMorgNakV1Wire', () => {
    expect(buildMorgNakV1Wire({ msgId: 'cafebabe', phase: 'chroma', mask: 0x88 })).toBe(
      '[[MORG_NAK_V1:msgId=cafebabe|phase=chroma|mask=00000088]]'
    )
  })
})

describe('MORG_SEG_V1 Wire-Budget', () => {
  it('Default-Max-Rohbytes passt in Meshtastic-UTF8-Limit', () => {
    expect(MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES).toBe(500)
    expect(MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES).toBe(321)
    const raw = new Uint8Array(MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES)
    const w = buildMorgSegV1Wire({
      msgId: 'deadbeef',
      phase: 'luma',
      seg: 0,
      n: 16,
      raw,
    })
    expect(wireUtf8ByteLength(w)).toBeLessThanOrEqual(500)
    expect(MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES).toBeGreaterThan(200)
  })

  it('ein Byte mehr verletzt das Limit (bei gleichen Header-Dimensionen)', () => {
    const max = MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES
    const wOk = buildMorgSegV1Wire({
      msgId: 'deadbeef',
      phase: 'luma',
      seg: 0,
      n: 16,
      raw: new Uint8Array(max),
    })
    const wBad = buildMorgSegV1Wire({
      msgId: 'deadbeef',
      phase: 'luma',
      seg: 0,
      n: 16,
      raw: new Uint8Array(max + 1),
    })
    expect(wireUtf8ByteLength(wOk)).toBeLessThanOrEqual(500)
    expect(wireUtf8ByteLength(wBad)).toBeGreaterThan(500)
  })

  it('längere msgId/n-Digits reduzieren das Maximum', () => {
    const small = computeMaxMorgSegV1RawPayloadBytes({
      msgId: 'deadbeef',
      phase: 'luma',
      seg: 0,
      n: 16,
    })
    const smaller = computeMaxMorgSegV1RawPayloadBytes({
      msgId: 'deadbeef',
      phase: 'luma',
      seg: 99,
      n: 999,
    })
    expect(smaller).toBeLessThanOrEqual(small)
  })
})
