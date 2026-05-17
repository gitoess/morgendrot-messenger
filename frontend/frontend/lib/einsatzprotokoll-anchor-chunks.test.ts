import { describe, expect, it } from 'vitest'
import {
  buildProtokollFullWireChunks,
  parseProtokollFullChunkWire,
  reassembleProtokollFullChunks,
} from '@/frontend/lib/einsatzprotokoll-anchor-chunks'
import { MESSAGING_WIRE_UTF8_MAX, wireUtf8ByteLength } from '@/frontend/lib/compact-image-wire'

describe('einsatzprotokoll-anchor-chunks', () => {
  it('splits large JSON under wire limit and reassembles', () => {
    const json = JSON.stringify({ messages: [{ id: 'a', content: 'x'.repeat(20_000) }] })
    const h = 'ab'.repeat(32)
    const wires = buildProtokollFullWireChunks(json, h)
    expect(wires.length).toBeGreaterThan(1)
    for (const w of wires) {
      expect(wireUtf8ByteLength(w)).toBeLessThanOrEqual(MESSAGING_WIRE_UTF8_MAX)
      const parsed = parseProtokollFullChunkWire(w)
      expect(parsed?.h).toBe(h)
    }
    const payloads = wires.map((w) => parseProtokollFullChunkWire(w)!)
    const r = reassembleProtokollFullChunks(payloads)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.json).toBe(json)
  })
})
