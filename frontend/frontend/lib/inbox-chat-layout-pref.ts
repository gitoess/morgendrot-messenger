/** Posteingang: Detail (Forensik) vs. schlanke Chat-Blasen. Default Detail. */
export const INBOX_CHAT_LAYOUT_LS_KEY = 'morgendrot.inboxChatLayout'

export type InboxChatLayoutMode = 'detail' | 'chat'

export function readInboxChatLayoutMode(): InboxChatLayoutMode {
  if (typeof window === 'undefined') return 'detail'
  try {
    return window.localStorage.getItem(INBOX_CHAT_LAYOUT_LS_KEY) === 'chat' ? 'chat' : 'detail'
  } catch {
    return 'detail'
  }
}

export function writeInboxChatLayoutMode(mode: InboxChatLayoutMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(INBOX_CHAT_LAYOUT_LS_KEY, mode)
  } catch {
    /* ignore */
  }
}

/** Chain/RPC ohne Zeit → 0; UI darf nicht „1.1.1970“ zeigen. */
export function isInboxTimestampKnown(ts: number): boolean {
  return Number.isFinite(ts) && ts > 0
}

/** Kalendertag lokal für Tagestrenner (YYYY-MM-DD). */
export function inboxMessageDayKey(ts: number): string {
  if (!isInboxTimestampKnown(ts)) return 'unknown'
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatInboxDayHeading(ts: number): string {
  if (!isInboxTimestampKnown(ts)) return 'Zeit unbekannt'
  const d = new Date(ts)
  const today = new Date()
  const yday = new Date()
  yday.setDate(today.getDate() - 1)
  const key = inboxMessageDayKey(ts)
  if (key === inboxMessageDayKey(today.getTime())) return 'Heute'
  if (key === inboxMessageDayKey(yday.getTime())) return 'Gestern'
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

/** Detail-/Listen-Zeitstempel; fehlende Chain-Zeit → ehrlich statt Epoch. */
export function formatInboxMessageTime(ts: number, locale = 'de-DE'): string {
  if (!isInboxTimestampKnown(ts)) return 'Zeit unbekannt'
  return new Date(ts).toLocaleString(locale)
}
