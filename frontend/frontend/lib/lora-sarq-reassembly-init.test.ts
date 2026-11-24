import { describe, expect, it } from 'vitest'
import { MorgSegV1ReassemblyBuffer } from './lora-sarq-reassembly'
import { buildMorgSegV1Wire } from './lora-sarq-wire'
import { parseMorgSegV1Message } from './lora-sarq-parser'

describe('MorgSegV1ReassemblyBuffer seedFromInit / NAK', () => {
  it('INIT → NAK für alle Indizes; Resume nur fehlende', () => {
    const buf = new MorgSegV1ReassemblyBuffer({ maxNakRounds: 3 })
    buf.seedFromInit('aabbccdd', 'luma', 3)
    const nak0 = buf.emitNakNow()
    expect(nak0).toMatch(/MORG_NAK_V1/)
    expect(nak0).toContain('aabbccdd')

    const seg0 = buildMorgSegV1Wire({
      msgId: 'aabbccdd',
      phase: 'luma',
      seg: 0,
      n: 3,
      raw: new Uint8Array([1, 2, 3]),
    })
    const p0 = parseMorgSegV1Message(seg0)!
    buf.ingest(p0)
    const nak1 = buf.emitNakNow()
    expect(nak1).toMatch(/MORG_NAK_V1/)
  })
})
