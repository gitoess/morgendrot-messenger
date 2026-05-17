import type { TelegramJournalEntryClient } from '@/frontend/lib/api/telegram-journal'
import type { Message } from '@/frontend/lib/types'

/** Telegram-Journal → Posteingangs-Zeilen (lokal, kein IOTA). */
export function mapTelegramJournalToMessages(
  entries: TelegramJournalEntryClient[],
  myAddress: string
): Message[] {
  const me = myAddress.trim()
  return entries.map((e) => {
    const out = e.direction === 'out'
    const cp = e.contactKey?.trim() || `tg:${e.chatId}`
    const content =
      e.direction === 'in' && e.senderLabel?.trim()
        ? `${e.senderLabel.trim()}: ${e.text}`
        : e.text
    return {
      id: e.id,
      from: out ? me : cp,
      recipient: out ? cp : me,
      content,
      timestamp: e.ts,
      encrypted: false,
      source: 'telegram',
      transports: ['telegram'],
      dedupKey: `telegram|${e.direction}|${cp}|${e.text.slice(0, 80)}|${Math.floor(e.ts / 60_000)}`,
    }
  })
}
