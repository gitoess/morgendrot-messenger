import { describe, expect, it, beforeEach } from 'vitest'
import { MorgSegV1ReassemblyBuffer } from '@/frontend/lib/lora-sarq-reassembly'
import {
  clearLoraSarqRxDraft,
  loadLoraSarqRxDraft,
  saveLoraSarqRxDraft,
} from '@/frontend/lib/lora-sarq-rx-draft'
import { buildMorgSegV1Wire } from '@/frontend/lib/lora-sarq-wire'
import { parseMorgSegV1Message } from '@/frontend/lib/lora-sarq-parser'

describe('lora-sarq-rx-draft + snapshot', () => {
  beforeEach(() => clearLoraSarqRxDraft())

  it('export/import behält Segmente; NAK nach Restore möglich', () => {
    const buf = new MorgSegV1ReassemblyBuffer()
    const raw = new Uint8Array([1, 2, 3, 4])
    const wire = buildMorgSegV1Wire({
      msgId: 'aabbccdd',
      phase: 'luma',
      seg: 0,
      n: 3,
      raw,
    })
    const parsed = parseMorgSegV1Message(wire)
    expect(parsed).toBeTruthy()
    buf.ingest(parsed!)
    const snap = buf.exportSnapshot()
    expect(snap?.n).toBe(3)
    expect(Object.keys(snap!.segsB64)).toEqual(['0'])

    saveLoraSarqRxDraft(snap, 'luma')
    const loaded = loadLoraSarqRxDraft('luma')
    expect(loaded?.msgId).toBe('aabbccdd')

    const buf2 = new MorgSegV1ReassemblyBuffer()
    expect(buf2.importSnapshot(loaded!)).toBe(true)
    const nak = buf2.emitNakNow()
    expect(nak).toMatch(/MORG_NAK_V1/)
    expect(nak).toMatch(/aabbccdd/)
  })
})
