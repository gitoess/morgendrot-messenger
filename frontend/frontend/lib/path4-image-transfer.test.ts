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

  it('inbox group key', () => {
    const raw = buildPath4ImageInitWire({ msgId: 'aabbccdd', phase: 'chroma', n: 4 })
    const k = path4ImageInitInboxGroupKey({
      from: '0x' + '11'.repeat(32),
      content: raw,
    })
    expect(k).toContain('aabbccdd')
    expect(k).toContain('chroma')
  })
})
