/** M3: angeheftete Pinnwand-Nachrichten (lokal, sessionStorage). */

const LS_PINNED = 'morg.pinnwand.pinned.ids.v1'
const MAX_PINNED_IDS = 200
const MAX_PIN_ID_LEN = 256
const PIN_ID_RE = /^[\w.-]{1,256}$/

function sanitizePinId(id: string): string | null {
  const t = String(id || '').trim()
  if (!t || t.length > MAX_PIN_ID_LEN) return null
  return PIN_ID_RE.test(t) ? t : null
}

function sanitizePinIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const id = sanitizePinId(item)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_PINNED_IDS) break
  }
  return out
}

export function readPinnedPinnwandIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(LS_PINNED)
    if (!raw) return new Set()
    const j = JSON.parse(raw) as unknown
    return new Set(sanitizePinIdList(j))
  } catch {
    return new Set()
  }
}

export function writePinnedPinnwandIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  const list = sanitizePinIdList([...ids])
  sessionStorage.setItem(LS_PINNED, JSON.stringify(list))
}

export function togglePinnedPinnwandId(id: string): boolean {
  const pinId = sanitizePinId(id)
  if (!pinId) return false
  const s = readPinnedPinnwandIds()
  const nowPinned = !s.has(pinId)
  if (nowPinned) {
    if (s.size >= MAX_PINNED_IDS) return false
    s.add(pinId)
  } else {
    s.delete(pinId)
  }
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
