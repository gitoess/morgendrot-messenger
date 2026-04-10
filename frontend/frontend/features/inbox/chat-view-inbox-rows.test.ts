import { describe, it, expect } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import { buildChatInboxRows, mergeMeshInboundBannerRows } from './chat-view-inbox-rows'
import type { CompletedSlideSequence } from './inbox-slideshow'

function m(id: string, from: string, content: string, ts: number): Message {
  return { id, from, content, timestamp: ts }
}

describe('buildChatInboxRows', () => {
  it('sortiert Nachrichten absteigend nach timestamp', () => {
    const rows = buildChatInboxRows(
      [m('1', '0xa', 'a', 10), m('2', '0xb', 'b', 50)],
      []
    )
    expect(rows.map((r) => (r.kind === 'msg' ? r.sortTs : 0))).toEqual([50, 10])
  })

  it('blendet Nachrichten aus, die in einer Slide-Sequenz stecken', () => {
    const slide: CompletedSlideSequence = {
      key: 'k',
      framesBase64: ['X'],
      hiddenMessageIds: ['hid'],
      sortTs: 99,
    }
    const rows = buildChatInboxRows(
      [m('hid', '0xa', 'hidden', 40), m('vis', '0xa', 'see', 30)],
      [slide]
    )
    const msgIds = rows.filter((r) => r.kind === 'msg').map((r) => r.msg.id)
    expect(msgIds).toEqual(['vis'])
    expect(rows.some((r) => r.kind === 'slide' && r.key === 'k')).toBe(true)
  })
})

describe('mergeMeshInboundBannerRows', () => {
  it('fügt Banner ohne Absender vorne ein', () => {
    const base = buildChatInboxRows([m('1', '0xa', 'x', 10)], [])
    const merged = mergeMeshInboundBannerRows(base, {
      b1: { hint: 'h', error: null, sortTs: 5 },
    })
    expect(merged[0]!.kind).toBe('meshInbound')
    expect((merged[0] as { id: string }).id).toBe('b1')
  })

  it('platziert Banner mit fromAddr unter Block des Absenders', () => {
    const base = buildChatInboxRows(
      [
        m('new', '0xs', 'neu', 100),
        m('old', '0xs', 'alt', 50),
        m('other', '0yo', 'fremd', 80),
      ],
      []
    )
    const merged = mergeMeshInboundBannerRows(base, {
      ban: { hint: 'mesh', error: null, sortTs: 90, fromAddr: '0xs' },
    })
    const idxNew = merged.findIndex((r) => r.kind === 'msg' && r.msg.id === 'new')
    const idxBan = merged.findIndex((r) => r.kind === 'meshInbound' && r.id === 'ban')
    expect(idxNew).toBeGreaterThanOrEqual(0)
    expect(idxBan).toBe(idxNew + 1)
  })
})
