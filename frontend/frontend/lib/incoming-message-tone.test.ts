import { describe, expect, it } from 'vitest'
import {
  classifyIncomingToneChannel,
  collectNovelInboxMessages,
  pickIncomingToneChannel,
} from '@/frontend/lib/incoming-message-tone'
import type { Message } from '@/frontend/lib/types'

const ME = `0x${'1'.repeat(64)}`
const PEER = `0x${'2'.repeat(64)}`

describe('incoming-message-tone (§ kritisch MVP)', () => {
  it('klassifiziert Pinnwand / Gruppe / Dialog', () => {
    expect(classifyIncomingToneChannel({ pinnwandPost: true })).toBe('pinnwand')
    expect(classifyIncomingToneChannel({ chainPurgeKind: 'team-broadcast' })).toBe('group')
    expect(classifyIncomingToneChannel({})).toBe('dialog')
  })

  it('ignoriert eigene Nachrichten', () => {
    expect(
      pickIncomingToneChannel([{ from: ME, chainPurgeKind: 'pairwise' }], ME)
    ).toBeNull()
  })

  it('wählt Gruppe vor Dialog bei gemischtem Poll', () => {
    expect(
      pickIncomingToneChannel(
        [
          { from: PEER },
          { from: PEER, chainPurgeKind: 'team-broadcast' },
        ],
        ME
      )
    ).toBe('group')
  })

  it('wählt Pinnwand wenn nur Pinnwand-Novel', () => {
    expect(
      pickIncomingToneChannel([{ from: PEER, pinnwandPost: true }], ME)
    ).toBe('pinnwand')
  })

  it('collectNovel erkennt neue Telegram-Zeilen', () => {
    const prev: Message[] = [
      { id: 'tg-1', from: 'tg:1', content: 'alt', timestamp: 1, source: 'telegram' },
    ]
    const incoming: Message[] = [
      prev[0]!,
      { id: 'tg-2', from: 'tg:1', content: 'neu', timestamp: 2, source: 'telegram' },
    ]
    expect(collectNovelInboxMessages(prev, incoming).map((m) => m.id)).toEqual(['tg-2'])
  })
})
