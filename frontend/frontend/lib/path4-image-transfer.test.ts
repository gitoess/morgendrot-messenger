import { describe, expect, it } from 'vitest'
import {
  buildPath4ImageInitWire,
  parsePath4ImageInitMessage,
  path4ImageInitInboxGroupKey,
} from './path4-image-transfer'

describe('path4-image-transfer (H.25a IMG_INIT)', () => {
  it('build und parse INIT', () => {
    const raw = buildPath4ImageInitWire({
      msgId: 'deadbeef',
      phase: 'luma',
      n: 12,
      jpeg: new Uint8Array([1, 2, 3]),
    })
    const p = parsePath4ImageInitMessage(raw)
    expect(p?.msgId).toBe('deadbeef')
    expect(p?.phase).toBe('luma')
    expect(p?.n).toBe(12)
    expect(p?.imageHashCrc16).toBeTypeOf('number')
  })

  it('inbox group key kollabiert auf Absender+msgId (ohne Phase)', () => {
    const from = '0x' + '11'.repeat(32)
    const luma = buildPath4ImageInitWire({ msgId: 'aabbccdd', phase: 'luma', n: 4 })
    const chroma = buildPath4ImageInitWire({ msgId: 'aabbccdd', phase: 'chroma', n: 4 })
    const kL = path4ImageInitInboxGroupKey({ from, content: luma })
    const kC = path4ImageInitInboxGroupKey({ from, content: chroma })
    expect(kL).toContain('aabbccdd')
    expect(kL).toBe(kC)
    expect(kL).not.toMatch(/luma|chroma/)
  })
})
