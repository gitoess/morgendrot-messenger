import { describe, it, expect } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import { extractCompletedSlideSequences } from './inbox-slideshow'

function slideWire(seq: string, total: number, index: number, payload: string): string {
  return `[[MORG_SLIDE_V1:${seq}|${total}|${index}|${payload}]]`
}

function msg(id: string, content: string, timestamp: number): Message {
  return { id, from: '0xf', content, timestamp }
}

describe('extractCompletedSlideSequences', () => {
  it('rekonstruiert vollständige Sequenz (Indizes 0..total-1)', () => {
    const messages = [
      msg('a', slideWire('s1', 2, 1, 'QQ'), 20),
      msg('b', slideWire('s1', 2, 0, 'AA'), 10),
    ]
    const seqs = extractCompletedSlideSequences(messages)
    expect(seqs).toHaveLength(1)
    expect(seqs[0]!.key).toBe('s1')
    expect(seqs[0]!.framesBase64).toEqual(['AA', 'QQ'])
    expect(seqs[0]!.hiddenMessageIds.sort()).toEqual(['a', 'b'].sort())
    expect(seqs[0]!.sortTs).toBe(20)
  })

  it('liefert nichts bei fehlendem Fragment', () => {
    const messages = [msg('x', slideWire('s2', 3, 0, 'A'), 1)]
    expect(extractCompletedSlideSequences(messages)).toEqual([])
  })

  it('ignoriert Nachrichten ohne Slide-Wire', () => {
    const messages = [msg('p', 'plain', 5)]
    expect(extractCompletedSlideSequences(messages)).toEqual([])
  })
})
