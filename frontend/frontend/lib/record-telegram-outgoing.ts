import type { Message } from '@/frontend/lib/types'

export type AppendInboxMessageFn = (msg: Message) => void

/** Sofort im Posteingang/Ausgang anzeigen (Server-Journal wird beim Notify mitgeschrieben). */
export function recordTelegramOutgoing(
  append: AppendInboxMessageFn | undefined,
  myAddress: string,
  contactKey: string,
  text: string
): void {
  const me = myAddress.trim()
  const cp = contactKey.trim().toLowerCase()
  if (!append || !me || !cp || !text.trim()) return
  const ts = Date.now()
  const id = `telegram-out-local-${ts}-${Math.random().toString(36).slice(2, 9)}`
  append({
    id,
    from: me,
    recipient: cp,
    content: text.trim(),
    timestamp: ts,
    encrypted: false,
    source: 'telegram',
    transports: ['telegram'],
    dedupKey: `telegram|out|${cp}|${text.slice(0, 80)}|${Math.floor(ts / 60_000)}`,
  })
}
