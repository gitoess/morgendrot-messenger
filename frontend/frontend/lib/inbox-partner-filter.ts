/**
 * Posteingang: Gegenüber und Richtung aus Mailbox-Zeilen (`from`, `recipient`, eigene Adresse).
 * Eingehend = Absender ist nicht ich; ausgehend = Absender bin ich (Mailbox spiegelt gesendete Zeilen so).
 */
import type { Message } from '@/frontend/lib/types'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export function isMessageOutgoing(msg: Message, myAddress: string): boolean {
  if (!myAddress.trim()) return false
  return norm(msg.from) === norm(myAddress)
}

/** Gegenüber-Adresse für Filter-Chips: bei eigener Sendung der Empfänger, sonst der Absender. */
export function messageCounterpartyAddress(msg: Message, myAddress: string): string | null {
  if (!myAddress.trim()) return null
  if (isMessageOutgoing(msg, myAddress)) {
    const r = msg.recipient?.trim()
    return r && r.length > 0 ? r : null
  }
  const f = msg.from?.trim()
  return f && f.length > 0 ? f : null
}

export type InboxDirectionFilter = 'all' | 'in' | 'out'

export function filterInboxMessagesByPartnerAndDirection(
  messages: Message[],
  myAddress: string,
  partnerAddress: string | null,
  direction: InboxDirectionFilter
): Message[] {
  return messages.filter((m) => {
    if (direction === 'in' && isMessageOutgoing(m, myAddress)) return false
    if (direction === 'out' && !isMessageOutgoing(m, myAddress)) return false
    if (!partnerAddress) return true
    const cp = messageCounterpartyAddress(m, myAddress)
    if (!cp) return false
    return norm(cp) === norm(partnerAddress)
  })
}

export function uniqueCounterpartyAddresses(messages: Message[], myAddress: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of messages) {
    const cp = messageCounterpartyAddress(m, myAddress)
    if (!cp) continue
    const k = norm(cp)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(cp)
  }
  out.sort((a, b) => norm(a).localeCompare(norm(b)))
  return out
}
