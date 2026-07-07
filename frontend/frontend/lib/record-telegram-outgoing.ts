import type { Message } from '@/frontend/lib/types'
import {
  applyTelegramOutboundRecipients,
  buildTelegramOutboundDedupKey,
  normalizeTelegramContactKey,
} from '@/frontend/lib/telegram-outbound-inbox'

export type AppendInboxMessageFn = (msg: Message) => void

function buildTelegramOutgoingRow(
  myAddress: string,
  recipients: string[],
  text: string,
  ts: number,
  idPrefix: string
): Message {
  const me = myAddress.trim()
  const trimmed = text.trim()
  const keys = recipients.map((r) => normalizeTelegramContactKey(r)).filter(Boolean)
  const base: Message = {
    id: `${idPrefix}-${ts}-${Math.random().toString(36).slice(2, 9)}`,
    from: me,
    recipient: keys[0] ?? '',
    content: trimmed,
    timestamp: ts,
    encrypted: false,
    source: 'telegram',
    transports: ['telegram'],
    dedupKey: buildTelegramOutboundDedupKey(me, trimmed, ts),
  }
  return applyTelegramOutboundRecipients(base, keys)
}

/** Sofort im Posteingang/Ausgang anzeigen (Server-Journal wird beim Notify mitgeschrieben). */
export function recordTelegramOutgoing(
  append: AppendInboxMessageFn | undefined,
  myAddress: string,
  contactKey: string,
  text: string
): void {
  recordTelegramOutgoingMany(append, myAddress, [contactKey], text)
}

/** Mehrere tg:-Empfänger → eine Ausgangszeile im Posteingang. */
export function recordTelegramOutgoingMany(
  append: AppendInboxMessageFn | undefined,
  myAddress: string,
  contactKeys: string[],
  text: string
): void {
  const me = myAddress.trim()
  const keys = contactKeys.map((k) => normalizeTelegramContactKey(k)).filter(Boolean)
  if (!append || !me || keys.length === 0 || !text.trim()) return
  append(buildTelegramOutgoingRow(me, keys, text, Date.now(), 'telegram-out-local'))
}
