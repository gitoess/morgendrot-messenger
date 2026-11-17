/**
 * Stumm pro Chat (T53) — nur Eingangs-Ton / lokale Pref; kein On-Chain-Block.
 */

export const INBOX_CHAT_MUTE_PREFS_CHANGED = 'morgendrot:inbox-chat-mute-prefs-changed'

const LS_MUTED = 'morgendrot.inbox.mutedChats.v1'

function emitChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(INBOX_CHAT_MUTE_PREFS_CHANGED))
  } catch {
    /* ignore */
  }
}

function normKey(raw: string): string {
  return raw.trim().toLowerCase()
}

export function readMutedChatKeys(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_MUTED)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.map((x) => normKey(String(x ?? ''))).filter(Boolean))]
  } catch {
    return []
  }
}

function writeMutedChatKeys(keys: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_MUTED, JSON.stringify([...new Set(keys.map(normKey).filter(Boolean))]))
    emitChanged()
  } catch {
    /* ignore */
  }
}

export function isChatMuted(key: string): boolean {
  const k = normKey(key)
  if (!k) return false
  return readMutedChatKeys().includes(k)
}

export function setChatMuted(key: string, muted: boolean): void {
  const k = normKey(key)
  if (!k) return
  const cur = new Set(readMutedChatKeys())
  if (muted) cur.add(k)
  else cur.delete(k)
  writeMutedChatKeys([...cur])
}

export function toggleChatMuted(key: string): boolean {
  const next = !isChatMuted(key)
  setChatMuted(key, next)
  return next
}
