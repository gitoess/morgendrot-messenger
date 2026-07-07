import type { Message } from './types'
import {
  applyTelegramOutboundRecipients,
  mergeTelegramOutboundRecipientKeys,
} from '@/frontend/lib/telegram-outbound-inbox'

const DEFAULT_WINDOW_MS = 120_000

function isEncryptedPlaceholderContent(s: string): boolean {
  return s.trimStart().startsWith('[Verschlüsselt]')
}

/** Beim Dedup-Merge: echte Entschlüsselung vor Platzhalter, längerer Klartext sonst. */
export function pickMergedInboxContent(a: string, b: string): string {
  const aa = a ?? ''
  const bb = b ?? ''
  const aPh = isEncryptedPlaceholderContent(aa)
  const bPh = isEncryptedPlaceholderContent(bb)
  if (aPh && !bPh) return bb
  if (bPh && !aPh) return aa
  return bb.length >= aa.length ? bb : aa
}

/** Gleicher Klartext vom gleichen Absender im Zeitfenster → eine Zeile, mehrere Transport-Icons. */
export function contentDedupKey(
  sender: string,
  text: string,
  ts: number,
  windowMs: number = DEFAULT_WINDOW_MS
): string {
  const bucket = Math.floor(ts / windowMs)
  return `${sender.trim().toLowerCase()}|${text.trim()}|${bucket}`
}

export function mergeMessageByDedup(prev: Message[], msg: Message): Message[] {
  const key = msg.dedupKey
  if (!key) {
    const byId = prev.findIndex((m) => m.id === msg.id)
    if (byId >= 0) {
      const cur = prev[byId]!
      const merged: Message = {
        ...cur,
        ...msg,
        id: cur.id,
        content: pickMergedInboxContent(cur.content ?? '', msg.content ?? ''),
      }
      const rest = prev.filter((_, j) => j !== byId)
      return [merged, ...rest]
    }
    return [msg, ...prev]
  }
  const i = prev.findIndex((m) => m.dedupKey === key)
  if (i < 0) return [msg, ...prev]
  const cur = prev[i]!
  const tr = new Set<'internet' | 'lan' | 'mesh' | 'adhoc' | 'telegram'>([
    ...(cur.transports ?? []),
    ...(msg.transports ?? []),
  ])
  const mc = msg.content ?? ''
  const cc = cur.content ?? ''
  const sameChainNonce =
    cur.chainNonce &&
    msg.chainNonce &&
    cur.chainNonce === msg.chainNonce &&
    cur.from.trim().toLowerCase() === msg.from.trim().toLowerCase()
  const merged: Message = {
    ...cur,
    ...msg,
    id: cur.id,
    timestamp: sameChainNonce ? cur.timestamp : Math.max(cur.timestamp, msg.timestamp),
    transports: [...tr],
    content: pickMergedInboxContent(cc, mc),
    encrypted: Boolean(msg.encrypted || cur.encrypted),
    pinnwandPost: cur.pinnwandPost === true || msg.pinnwandPost === true ? true : undefined,
  }
  if (
    merged.source === 'telegram' &&
    cur.from.trim().toLowerCase() === msg.from.trim().toLowerCase() &&
    key.startsWith('telegram|out|')
  ) {
    const withRecipients = applyTelegramOutboundRecipients(
      merged,
      mergeTelegramOutboundRecipientKeys(cur, msg)
    )
    const rest = prev.filter((_, j) => j !== i)
    return [withRecipients, ...rest]
  }
  const rest = prev.filter((_, j) => j !== i)
  return [merged, ...rest]
}

export function mergeAllMessages(rows: Message[]): Message[] {
  let acc: Message[] = []
  for (const m of rows) {
    acc = mergeMessageByDedup(acc, m)
  }
  return acc.sort((a, b) => b.timestamp - a.timestamp)
}

/** Einzelzeile für Signatur — Inhalt/verschlüsselt müssen rein, sonst bleibt Platzhalter-Stand nach API-Merge. */
function inboxMessageSigPart(m: Message): string {
  const c = m.content ?? ''
  const ph = isEncryptedPlaceholderContent(c) ? 'ph' : 'tx'
  return `${m.id}:${m.timestamp}:${m.encrypted ? 1 : 0}:${ph}:${c.length}`
}

/** Signatur für „Liste unverändert“ — vermeidet unnötige React-Updates. */
export function inboxMessageListSignature(messages: Message[]): string {
  return messages.map(inboxMessageSigPart).join('|')
}

/** Journal-Zeilen mergen; gibt `prev` zurück wenn sich nichts ändert. */
export function mergeJournalIntoInboxIfChanged(prev: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return prev
  const prevIds = new Set(prev.map((m) => m.id))
  const prevDedup = new Set(prev.map((m) => m.dedupKey).filter((k): k is string => Boolean(k)))
  const novel = incoming.filter((m) => {
    if (prevIds.has(m.id)) return false
    if (m.dedupKey && prevDedup.has(m.dedupKey)) return false
    return true
  })
  if (novel.length === 0) return prev
  const next = mergeAllMessages([...prev, ...novel])
  if (inboxMessageListSignature(prev) === inboxMessageListSignature(next)) return prev
  return next
}
