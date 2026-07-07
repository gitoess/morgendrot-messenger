import type { Message } from '@/frontend/lib/types'
import { normalizeTelegramRecipientInput } from '@/frontend/lib/telegram-notify-pref'

const OUTBOUND_WINDOW_MS = 60_000

/** Gleicher Klartext + Absender + Zeitfenster → eine Posteingangszeile (mehrere tg:-Empfänger). */
export function buildTelegramOutboundDedupKey(
  sender: string,
  text: string,
  ts: number,
  windowMs: number = OUTBOUND_WINDOW_MS
): string {
  const me = sender.trim().toLowerCase()
  const bucket = Math.floor(ts / windowMs)
  return `telegram|out|${me}|${text.trim().slice(0, 80)}|${bucket}`
}

export function normalizeTelegramContactKey(raw: string): string {
  const t = raw.trim().toLowerCase()
  if (!t) return ''
  if (t.startsWith('tg:')) return t
  return normalizeTelegramRecipientInput(t)
}

/** Alle tg:-Gegenüber einer ausgehenden Telegram-Zeile (inkl. Broadcast). */
export function telegramOutboundCounterpartyKeys(msg: Message): string[] {
  const keys = new Set<string>()
  const add = (raw?: string) => {
    const k = normalizeTelegramContactKey(raw ?? '')
    if (k) keys.add(k)
  }
  add(msg.recipient)
  for (const r of msg.telegramRecipients ?? []) add(r)
  return [...keys]
}

export function mergeTelegramOutboundRecipientKeys(a: Message, b: Message): string[] {
  const keys = new Set<string>()
  for (const k of telegramOutboundCounterpartyKeys(a)) keys.add(k)
  for (const k of telegramOutboundCounterpartyKeys(b)) keys.add(k)
  return [...keys]
}

export function applyTelegramOutboundRecipients(msg: Message, recipients: string[]): Message {
  const unique = [...new Set(recipients.map((r) => normalizeTelegramContactKey(r)).filter(Boolean))]
  if (unique.length === 0) return msg
  if (unique.length === 1) {
    const { telegramRecipients: _drop, ...rest } = msg
    return { ...rest, recipient: unique[0] }
  }
  return {
    ...msg,
    recipient: unique[0],
    telegramRecipients: unique,
  }
}

export function formatTelegramOutboundRecipientLine(recipients: string[]): string | null {
  const keys = [...new Set(recipients.map((r) => normalizeTelegramContactKey(r)).filter(Boolean))]
  if (keys.length === 0) return null
  if (keys.length === 1) {
    const r = keys[0]!
    if (r.length <= 14) return `An ${r}`
    return `An ${r.slice(0, 8)}…${r.slice(-4)}`
  }
  return `An ${keys.length} Telegram-Empfänger`
}
