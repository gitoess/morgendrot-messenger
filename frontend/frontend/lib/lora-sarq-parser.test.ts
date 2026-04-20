import { describe, expect, it } from 'vitest'
import { buildMorgNakV1Wire, buildMorgSegV1Wire, crc16CcittFalse } from '@/frontend/lib/lora-sarq-wire'
import {
  messageLooksLikeMorgSegV1Wire,
  parseMorgNakV1Message,
  parseMorgSegV1Message,
} from '@/frontend/lib/lora-sarq-parser'

describe('messageLooksLikeMorgSegV1Wire', () => {
  it('erkennt Präfix nach Normalisierung', () => {
    const w = buildMorgSegV1Wire({ msgId: '11111111', phase: 'luma', seg: 0, n: 1, raw: new Uint8Array([1]) })
    expect(messageLooksLikeMorgSegV1Wire(`  ${w}  `)).toBe(true)
    expect(messageLooksLikeMorgSegV1Wire('hello')).toBe(false)
  })
})

describe('parseMorgSegV1Message', () => {
  it('roundtrip mit buildMorgSegV1Wire', () => {
    const raw = new Uint8Array([1, 2, 3, 250])
    const wire = buildMorgSegV1Wire({
      msgId: 'aabbccdd',
      phase: 'luma',
      seg: 2,
      n: 8,
      raw,
    })
    const p = parseMorgSegV1Message(wire)
    expect(p).not.toBeNull()
    expect(p!.msgId).toBe('aabbccdd')
    expect(p!.phase).toBe('luma')
    expect(p!.seg).toBe(2)
    expect(p!.n).toBe(8)
    expect(p!.wireCrc16).toBe(crc16CcittFalse(raw) & 0xffff)
    expect(Array.from(p!.raw)).toEqual(Array.from(raw))
  })

  it('null bei falschem CRC', () => {
    const raw = new Uint8Array([9])
    const ok = buildMorgSegV1Wire({ msgId: '00000001', phase: 'chroma', seg: 0, n: 1, raw })
    const broken = ok.replace(/\|crc=[a-f0-9]{4}\]\]$/, '|crc=0000]]')
    expect(parseMorgSegV1Message(broken)).toBeNull()
  })

  it('null bei Truncation', () => {
    const w = buildMorgSegV1Wire({
      msgId: 'deadbeef',
      phase: 'luma',
      seg: 0,
      n: 2,
      raw: new Uint8Array(10),
    })
    expect(parseMorgSegV1Message(w.slice(0, w.length - 5))).toBeNull()
  })
})

describe('parseMorgNakV1Message', () => {
  it('roundtrip', () => {
    const w = buildMorgNakV1Wire({ msgId: 'cafebabe', phase: 'chroma', mask: 0x88 })
    const p = parseMorgNakV1Message(w)
    expect(p).toEqual({ msgId: 'cafebabe', phase: 'chroma', mask: 0x88 })
  })
})
