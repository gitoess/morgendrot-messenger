import { describe, expect, it } from 'vitest'
import { buildMorgSegV1Wire } from '@/frontend/lib/lora-sarq-wire'
import { parseMorgSegV1Message } from '@/frontend/lib/lora-sarq-parser'
import { MorgSegV1ReassemblyBuffer } from '@/frontend/lib/lora-sarq-reassembly'

function seg(msgId8: string, phase: 'luma' | 'chroma', seg: number, n: number, bytes: number[]) {
  const raw = new Uint8Array(bytes)
  const w = buildMorgSegV1Wire({ msgId: msgId8, phase, seg, n, raw })
  const p = parseMorgSegV1Message(w)
  if (!p) throw new Error(`parse failed for ${msgId8}: ${w}`)
  return p
}

describe('MorgSegV1ReassemblyBuffer', () => {
  it('setzt n Segmente zusammen', () => {
    const b = new MorgSegV1ReassemblyBuffer()
    expect(b.ingest(seg('aaaaaaaa', 'luma', 0, 2, [1]))).toEqual({})
    const r = b.ingest(seg('aaaaaaaa', 'luma', 1, 2, [2, 3]))
    expect(r.assembled).toBeInstanceOf(Uint8Array)
    expect(Array.from(r.assembled!)).toEqual([1, 2, 3])
  })

  it('NAK bei Sessionwechsel wenn Lücken', () => {
    const b = new MorgSegV1ReassemblyBuffer()
    b.ingest(seg('aaaaaaaa', 'luma', 0, 2, [1]))
    const r = b.ingest(seg('bbbbbbbb', 'luma', 0, 1, [9]))
    expect(r.staleSessionNak).toMatch(/MORG_NAK_V1:msgId=aaaaaaaa\|phase=luma\|mask=00000002/)
    expect(r.assembled && Array.from(r.assembled)).toEqual([9])
  })

  it('emitIdleNakRound: volle Fehlmaske, nach maxRounds frozen', () => {
    const b = new MorgSegV1ReassemblyBuffer({ maxNakRounds: 3 })
    b.ingest(seg('cccccccc', 'chroma', 0, 2, [7]))
    expect(b.emitIdleNakRound()).toMatch(/mask=00000002/)
    expect(b.emitIdleNakRound()).toMatch(/mask=00000002/)
    expect(b.emitIdleNakRound()).toMatch(/mask=00000002/)
    expect(b.emitIdleNakRound()).toBeNull()
    expect(b.isSessionFrozen()).toBe(true)
    expect(b.getNakRoundsSent()).toBe(3)
  })

  it('Duplikat-Segment: Gate „Neu?“, kein zweites Mal zählen', () => {
    const b = new MorgSegV1ReassemblyBuffer()
    const p0 = seg('dddddddd', 'luma', 0, 2, [1])
    expect(b.ingest(p0)).toEqual({})
    expect(b.ingest(p0)).toEqual({ duplicateSegment: true })
    expect(b.getReceivedMaskLower32()).toBe(1)
  })

  it('nach Freeze können späte Segmente noch vervollständigen', () => {
    const b = new MorgSegV1ReassemblyBuffer({ maxNakRounds: 1 })
    b.ingest(seg('eeeeeeee', 'luma', 0, 2, [1]))
    expect(b.emitIdleNakRound()).not.toBeNull()
    expect(b.isSessionFrozen()).toBe(true)
    const r = b.ingest(seg('eeeeeeee', 'luma', 1, 2, [2]))
    expect(r.assembled && Array.from(r.assembled)).toEqual([1, 2])
  })
})
