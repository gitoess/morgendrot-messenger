/** M3: angeheftete Pinnwand-Nachrichten (lokal, sessionStorage). */

const LS_PINNED = 'morg.pinnwand.pinned.ids.v1'

export function readPinnedPinnwandIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(LS_PINNED)
    if (!raw) return new Set()
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j)) return new Set()
    return new Set(j.filter((x): x is string => typeof x === 'string' && x.length > 0))
  } catch {
    return new Set()
  }
}

export function writePinnedPinnwandIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(LS_PINNED, JSON.stringify([...ids]))
}

export function togglePinnedPinnwandId(id: string): boolean {
  const s = readPinnedPinnwandIds()
  const nowPinned = !s.has(id)
  if (nowPinned) s.add(id)
  else s.delete(id)
  writePinnedPinnwandIds(s)
  return nowPinned
}

export function sortMessagesPinnedFirst<T extends { id: string; timestamp?: number }>(
  messages: T[],
  pinned: Set<string>
): T[] {
  if (pinned.size === 0) return messages
  const copy = [...messages]
  copy.sort((a, b) => {
    const ap = pinned.has(a.id) ? 1 : 0
    const bp = pinned.has(b.id) ? 1 : 0
    if (ap !== bp) return bp - ap
    return (b.timestamp ?? 0) - (a.timestamp ?? 0)
  })
  return copy
}
