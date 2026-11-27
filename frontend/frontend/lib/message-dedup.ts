import type { Message } from './types'
import {
  applyTelegramOutboundRecipients,
  mergeTelegramOutboundRecipientKeys,
} from '@/frontend/lib/telegram-outbound-inbox'

const DEFAULT_WINDOW_MS = 120_000

function isEncryptedPlaceholderContent(s: string): boolean {
  const t = s.trimStart()
  return t.startsWith('[Verschlüsselt]') || t.startsWith('[Double Ratchet')
}

function looksLikeEncryptedWire(s: string): boolean {
  const t = s.trim()
  return (
    t.startsWith('MORG_PWMSG_V1:') ||
    t.startsWith('MORG_NFTGATE_V1:') ||
    t.startsWith('[[MORG_ENV') ||
    /** API-Inbox: Session-Decrypt liefert RATCHET_V3-JSON — Merge bevorzugt Klartext. */
    (t.startsWith('{') && t.includes('RATCHET_V3'))
  )
}

/**
 * Exakte Doppel-Zeilen (gleicher Absender/Empfänger/Text, ≤2 s) — z. B. Event+Optimistic
 * oder Doppelklick vor Send-Lock. Bevorzugt Mailbox/Chain.
 */
export function collapseNearDuplicateThreadRows(rows: Message[], windowMs = 2000): Message[] {
  if (rows.length < 2) return rows
  const ranked = [...rows].sort((a, b) => b.timestamp - a.timestamp)
  const kept: Message[] = []
  const seen = new Set<string>()
  const score = (m: Message): number => {
    let s = 0
    if (m.chainPurgeable === true) s += 4
    if (m.chainNonce) s += 2
    if (typeof m.id === 'string' && m.id.startsWith('optimistic:')) s -= 3
    const c = m.content ?? ''
    if (c.includes('RATCHET_V3')) s -= 2
    if (c.trimStart().startsWith('[Double Ratchet')) s -= 5
    if (c.trimStart().startsWith('[Verschlüsselt]')) s -= 4
    return s
  }
  for (const m of ranked) {
    const from = (m.from ?? '').trim().toLowerCase()
    const to = (m.recipient ?? '').trim().toLowerCase()
    const text = (m.content ?? '').trim()
    if (!text) {
      kept.push(m)
      continue
    }
    const bucket = Math.floor((Number(m.timestamp) || 0) / windowMs)
    /** Empfänger fehlt oft bei Fragment-/Optimistic-Duplikat — dann nur from+text. */
    const key = `${from || '_'}|${to || '*'}|${text}|${bucket}`
    if (seen.has(key)) continue
    const peers = ranked.filter((o) => {
      const ob = Math.floor((Number(o.timestamp) || 0) / windowMs)
      if (ob !== bucket) return false
      if ((o.content ?? '').trim() !== text) return false
      const of = (o.from ?? '').trim().toLowerCase()
      const ot = (o.recipient ?? '').trim().toLowerCase()
      if (from && of && from !== of) return false
      if (to && ot && to !== ot) return false
      return true
    })
    peers.sort((a, b) => score(b) - score(a))
    const best = peers[0]!
    for (const p of peers) {
      const pf = (p.from ?? '').trim().toLowerCase()
      const pt = (p.recipient ?? '').trim().toLowerCase()
      seen.add(`${pf || '_'}|${pt || '*'}|${text}|${bucket}`)
    }
    kept.push(best)
  }
  return kept.sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Dedup-Merge-Priorität:
 * 1) Klartext  2) Hint/Platzhalter  3) Roh-Wire (RATCHET_V3 …)
 * Sonst gewinnt sonst oft der lange API-Hint gegen kurzen Direct-Klartext.
 */
export function pickMergedInboxContent(a: string, b: string): string {
  const aa = a ?? ''
  const bb = b ?? ''
  const aWire = looksLikeEncryptedWire(aa)
  const bWire = looksLikeEncryptedWire(bb)
  const aPh = isEncryptedPlaceholderContent(aa)
  const bPh = isEncryptedPlaceholderContent(bb)
  const aPlain = !aWire && !aPh
  const bPlain = !bWire && !bPh
  if (aPlain && !bPlain) return aa
  if (bPlain && !aPlain) return bb
  if (aPh && bWire) return aa
  if (bPh && aWire) return bb
  if (aPh && !bPh) return bb
  if (bPh && !aPh) return aa
  if (aWire && !bWire) return bb
  if (bWire && !aWire) return aa
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
    chainMailboxObjectId: msg.chainMailboxObjectId || cur.chainMailboxObjectId,
    chainNonce: msg.chainNonce || cur.chainNonce,
    chainPurgeable: msg.chainPurgeable === true || cur.chainPurgeable === true ? true : msg.chainPurgeable ?? cur.chainPurgeable,
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
