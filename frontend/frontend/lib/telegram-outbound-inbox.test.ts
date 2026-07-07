import { describe, it, expect } from 'vitest'
import { mapTelegramJournalToMessages } from '@/frontend/features/inbox/map-telegram-journal-messages'
import { mergeAllMessages } from '@/frontend/lib/message-dedup'
import {
  buildTelegramOutboundDedupKey,
  formatTelegramOutboundRecipientLine,
} from '@/frontend/lib/telegram-outbound-inbox'

const ME = '0x' + 'a'.repeat(64)

describe('telegram outbound inbox dedup', () => {
  it('führt mehrere Ausgangs-Journal-Zeilen zu einer Zeile zusammen', () => {
    const ts = 1_700_000_000_000
    const rows = mapTelegramJournalToMessages(
      [
        {
          id: 'tg-1',
          direction: 'out',
          chatId: '603668373',
          contactKey: 'tg:603668373',
          text: 'testttt111',
          ts,
        },
        {
          id: 'tg-2',
          direction: 'out',
          chatId: '145569734',
          contactKey: 'tg:145569734',
          text: 'testttt111',
          ts,
        },
        {
          id: 'tg-3',
          direction: 'out',
          chatId: '808030333',
          contactKey: 'tg:808030333',
          text: 'testttt111',
          ts,
        },
      ],
      ME
    )
    const merged = mergeAllMessages(rows)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.telegramRecipients).toEqual(['tg:603668373', 'tg:145569734', 'tg:808030333'])
    expect(buildTelegramOutboundDedupKey(ME, 'testttt111', ts)).toBe(rows[0]?.dedupKey)
  })

  it('formatiert Broadcast-Empfänger kompakt', () => {
    expect(
      formatTelegramOutboundRecipientLine(['tg:603668373', 'tg:145569734', 'tg:808030333'])
    ).toBe('An 3 Telegram-Empfänger')
  })
})
