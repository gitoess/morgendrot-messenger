/**
 * Posteingang: Gegenüber und Richtung aus Mailbox-Zeilen (`from`, `recipient`, eigene Adresse).
 * Eingehend = Absender ist nicht ich; ausgehend = Absender bin ich (Mailbox spiegelt gesendete Zeilen so).
 */
import type { Message } from '@/frontend/lib/types'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Volle Chain-Adresse vs. ggf. maskierte UI-Adresse aus /api/status (`0x12345678…abcd`).
 */
export function addressMatchesIdentity(chainAddr: string, identityFromUi: string): boolean {
  const c = norm(chainAddr)
  const i = norm(identityFromUi)
  if (!c || !i) return false
  if (c === i) return true
  if (!i.includes('…')) return false
  const parts = i.split('…')
  const head = parts[0] ?? ''
  const tail = parts[1] ?? ''
  // Ohne festen Kopf+Schwanz (wie in /api/status mask): keine Teiltreffer — sonst würde z. B.
  // "0x…" oder kurze Masken fast jede 0x-Adresse als „ich“ einstufen.
  if (head.length < 8 || tail.length < 4) return false
  return c.startsWith(head) && c.endsWith(tail)
}

export function isMessageOutgoing(msg: Message, myAddress: string): boolean {
  if (!myAddress.trim()) return false
  return addressMatchesIdentity(msg.from, myAddress)
}

/** Selbstgespräch: an die eigene Adresse gesendet (Absender und Empfänger = ich). Soll in Eingang, Ausgang und Alle erscheinen. */
export function isMessageSelfToSelf(msg: Message, myAddress: string): boolean {
  if (!myAddress.trim()) return false
  const f = msg.from?.trim()
  const r = msg.recipient?.trim()
  if (!f || !r) return false
  return addressMatchesIdentity(f, myAddress) && addressMatchesIdentity(r, myAddress)
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
    const selfToSelf = isMessageSelfToSelf(m, myAddress)
    const incomingMeshUnmapped =
      (m.source === 'mesh' || m.transports?.includes('mesh')) &&
      !isMessageOutgoing(m, myAddress) &&
      typeof m.from === 'string' &&
      m.from.startsWith('mesh:')
    if (incomingMeshUnmapped) {
      // Mesh-Eingang (ohne 0x-Mapping) immer anzeigen, sonst verschwindet er leicht durch Richtung/Partnerfilter.
      return true
    }
    if (direction === 'in' && isMessageOutgoing(m, myAddress) && !selfToSelf) return false
    if (direction === 'out' && !isMessageOutgoing(m, myAddress) && !selfToSelf) return false
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

/** Nachricht hat LoRa/Mesh-Kanal (Klartext-Funk, Mesh-Meta, …). */
export function messageTouchesMeshTransport(m: Message): boolean {
  return m.source === 'mesh' || (Array.isArray(m.transports) && m.transports.includes('mesh'))
}

/** Nachricht über Mailbox/IOTA (nicht reiner Mesh-only-Pfad). */
export function messageTouchesInternetTransport(m: Message): boolean {
  if (Array.isArray(m.transports) && m.transports.includes('internet')) return true
  if (m.source === 'mesh') return false
  return true
}

/** Posteingang „Nur IOTA“: Mailbox-/Online-Zeilen ohne Mesh-Anteil (kein `source: mesh`, kein Mesh in `transports`). */
export function messagePureInternetInboxRow(m: Message): boolean {
  return messageTouchesInternetTransport(m) && !messageTouchesMeshTransport(m)
}

/** Gegenüber-Adressen, die mindestens eine Nachricht mit `messagePred` haben. */
export function uniqueCounterpartyAddressesWhen(
  messages: Message[],
  myAddress: string,
  messagePred: (m: Message) => boolean
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of messages) {
    if (!messagePred(m)) continue
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
