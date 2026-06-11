import { describe, expect, it } from 'vitest'
import {
  countInboxByOverviewCategory,
  filterInboxByOverviewCategory,
  inboxMessageOverviewCategory,
  resolveOverviewFilteredInboxMessages,
} from '@/frontend/lib/inbox-overview-filter'
import type { Message } from '@/frontend/lib/types'

const BOARD = '0x' + 'a'.repeat(64)
const BOSS = '0x' + 'b'.repeat(64)

function msg(partial: Partial<Message> & { id: string }): Message {
  return {
    from: BOSS,
    recipient: BOSS,
    text: 'hi',
    timestamp: 1,
    ...partial,
  } as Message
}

describe('inbox-overview-filter', () => {
  const ctx = { myAddress: '0x' + 'c'.repeat(64), broadcastAddress: BOARD }

  it('klassifiziert Lagebild anhand Empfänger', () => {
    const m = msg({ id: '1', recipient: BOARD })
    expect(inboxMessageOverviewCategory(m, ctx)).toBe('lagebild')
  })

  it('klassifiziert Funk bei Mesh-Transport', () => {
    const m = msg({ id: '2', transports: ['mesh'] })
    expect(inboxMessageOverviewCategory(m, ctx)).toBe('funk')
  })

  it('blendet Lagebild aus Alle wenn Streifen aktiv', () => {
    const messages = [
      msg({ id: '1', recipient: BOARD }),
      msg({ id: '2', recipient: BOSS }),
    ]
    const out = filterInboxByOverviewCategory(messages, 'alle', {
      ...ctx,
      excludePinnwandFromAlle: true,
    })
    expect(out.map((m) => m.id)).toEqual(['2'])
  })

  it('zählt Kategorien für Chips', () => {
    const messages = [
      msg({ id: '1', recipient: BOARD }),
      msg({ id: '2', transports: ['mesh'] }),
      msg({ id: '3', recipient: BOSS }),
    ]
    const counts = countInboxByOverviewCategory(messages, { ...ctx, excludePinnwandFromAlle: true })
    expect(counts.lagebild).toBe(1)
    expect(counts.funk).toBe(1)
    expect(counts.direkt).toBe(1)
    expect(counts.alle).toBe(2)
  })

  it('resolveOverviewFilteredInboxMessages respektiert Kategorie', () => {
    const messages = [
      msg({ id: '1', recipient: BOARD }),
      msg({ id: '2', recipient: BOSS }),
    ]
    const ctxWithStrip = { ...ctx, excludePinnwandFromAlle: true }
    expect(
      resolveOverviewFilteredInboxMessages(messages, {
        overviewEnabled: true,
        category: 'lagebild',
        ctx: ctxWithStrip,
      }).map((m) => m.id)
    ).toEqual(['1'])
    expect(
      resolveOverviewFilteredInboxMessages(messages, {
        overviewEnabled: false,
        category: 'lagebild',
        ctx: ctxWithStrip,
      }).map((m) => m.id)
    ).toEqual(['1', '2'])
  })
})
