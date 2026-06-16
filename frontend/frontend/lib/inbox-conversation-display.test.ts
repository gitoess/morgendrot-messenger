import { describe, expect, it } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import { resolveActiveInboxDisplayMessages } from '@/frontend/lib/inbox-conversation-display'

function msg(id: string, from: string): Message {
  return { id, from, content: id, timestamp: 1, encrypted: false }
}

describe('resolveActiveInboxDisplayMessages', () => {
  const ctx = { myAddress: '0x' + '1'.repeat(64), broadcastAddress: '' }
  const mesh = msg('m', 'mesh:!1')
  mesh.source = 'mesh'
  const direkt = msg('d', '0x' + '2'.repeat(64))

  it('überspringt Overview-Kategorie bei aktivem 1:1-Thread', () => {
    const out = resolveActiveInboxDisplayMessages([mesh, direkt], {
      overviewEnabled: true,
      category: 'direkt',
      ctx,
      inboxPartnerFiltersArmed: true,
      inboxPartnerKey: '0x' + '2'.repeat(64),
      inboxConversationGroupId: null,
    })
    expect(out.map((m) => m.id)).toEqual(['m', 'd'])
  })

  it('wendet Overview an ohne Partner-Thread', () => {
    const out = resolveActiveInboxDisplayMessages([mesh, direkt], {
      overviewEnabled: true,
      category: 'direkt',
      ctx,
      inboxPartnerFiltersArmed: false,
      inboxPartnerKey: null,
      inboxConversationGroupId: null,
    })
    expect(out.map((m) => m.id)).toEqual(['d'])
  })
})
