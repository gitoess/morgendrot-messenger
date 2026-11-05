/**
 * Posteingang: Gegenüber und Richtung aus Mailbox-Zeilen (`from`, `recipient`, eigene Adresse).
 * Eingehend = Absender ist nicht ich; ausgehend = Absender bin ich (Mailbox spiegelt gesendete Zeilen so).
 */
import { isPlaceholderIotaAddress } from '@/frontend/lib/contact-storage-key'
import { telegramOutboundCounterpartyKeys } from '@/frontend/lib/telegram-outbound-inbox'
import type { Message } from '@/frontend/lib/types'

/** Keine Platzhalter-/Leer-Adressen als Posteingangs-Gegenüber. */
export function isIgnoredInboxCounterpartyAddress(raw: string): boolean {
  const a = raw.trim().toLowerCase()
  if (!a) return true
  if (isPlaceholderIotaAddress(a)) return true
  return false
}

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

/** Letzte Nachricht pro Gegenüber (Telegram-ähnliche Chat-Reihenfolge). */
export function buildPartnerLastMessageAtMap(
  messages: readonly Message[],
  myAddress: string
): Readonly<Record<string, number>> {
  const out: Record<string, number> = {}
  if (!myAddress.trim()) return out
  for (const m of messages) {
    const cp = messageCounterpartyAddress(m, myAddress)
    if (!cp || isIgnoredInboxCounterpartyAddress(cp)) continue
    const key = cp.trim().toLowerCase()
    const ts = Number(m.timestamp) || 0
    if (ts > (out[key] ?? 0)) out[key] = ts
  }
  return out
}

export type InboxDirectionFilter = 'all' | 'in' | 'out'

export type InboxPartnerFilterOpts = {
  /** M2: Union aller Gruppenmitglieder — `partnerAddress` wird ignoriert. */
  groupMemberAddresses?: string[]
  /** M2c: Team-Broadcast-Zeilen (recipient = Team-Mailbox-Object-ID). */
  teamMailboxObjectId?: string
}

/** Team-Broadcast-Zeile: Empfänger ist die Team-Mailbox-Object-ID (nicht pairwise 0x-Mitglied). */
export function isTeamBroadcastInboxRow(msg: Message, teamMailboxObjectId: string): boolean {
  const teamMb = norm(teamMailboxObjectId)
  if (!teamMb) return false
  const recip = norm(msg.recipient ?? '')
  if (recip !== teamMb) return false
  const dk = msg.dedupKey?.trim() ?? ''
  if (dk.startsWith('team:')) return true
  /** Fallback: recipient = Team-Object-ID reicht (pairwise nutzt Mitglieder-Adressen). */
  return true
}

export function filterInboxMessagesByPartnerAndDirection(
  messages: Message[],
  myAddress: string,
  partnerAddress: string | null,
  direction: InboxDirectionFilter,
  opts?: InboxPartnerFilterOpts
): Message[] {
  const groupNorms =
    opts?.groupMemberAddresses && opts.groupMemberAddresses.length > 0
      ? new Set(opts.groupMemberAddresses.map((a) => norm(a)))
      : null

  return messages.filter((m) => {
    const selfToSelf = isMessageSelfToSelf(m, myAddress)
    /** Funk/Mesh-Eingang (Klartext `mesh:…` oder v2 mit 0x-Absender): nicht über Mailbox-Richtung/Partner wegfiltern. */
    const incomingMeshRadio =
      (m.source === 'mesh' || m.transports?.includes('mesh')) && !isMessageOutgoing(m, myAddress)
    const telegramRow = messageTouchesTelegramTransport(m)
    if (telegramRow) {
      if (direction === 'in' && isMessageOutgoing(m, myAddress) && !selfToSelf) return false
      if (direction === 'out' && !isMessageOutgoing(m, myAddress) && !selfToSelf) return false
      if (groupNorms) {
        const cpTg = messageCounterpartyAddress(m, myAddress)
        if (cpTg && groupNorms.has(norm(cpTg))) return true
        return false
      }
      if (!partnerAddress) return true
      if (isMessageOutgoing(m, myAddress)) {
        const tgKeys = telegramOutboundCounterpartyKeys(m)
        if (tgKeys.length > 0) {
          return tgKeys.some((k) => norm(k) === norm(partnerAddress))
        }
      }
      const cpTg = messageCounterpartyAddress(m, myAddress)
      if (!cpTg) return false
      return norm(cpTg) === norm(partnerAddress)
    }
    if (incomingMeshRadio) {
      if (groupNorms) {
        const cpMesh = messageCounterpartyAddress(m, myAddress)
        if (cpMesh && groupNorms.has(norm(cpMesh))) return true
        return false
      }
      if (!partnerAddress) return true
      const cpMesh = messageCounterpartyAddress(m, myAddress)
      if (!cpMesh) return false
      return norm(cpMesh) === norm(partnerAddress)
    }
    if (direction === 'in' && isMessageOutgoing(m, myAddress) && !selfToSelf) return false
    if (direction === 'out' && !isMessageOutgoing(m, myAddress) && !selfToSelf) return false
    if (groupNorms) {
      const teamMb = opts?.teamMailboxObjectId ? norm(opts.teamMailboxObjectId) : ''
      if (teamMb) {
        if (isTeamBroadcastInboxRow(m, teamMb)) {
          const senderNorm = norm(m.from ?? '')
          if (addressMatchesIdentity(m.from, myAddress)) return true
          if (senderNorm && groupNorms.has(senderNorm)) return true
          return false
        }
        const recip = norm(m.recipient ?? '')
        const dk = m.dedupKey?.trim() ?? ''
        if (recip.startsWith('0x') && recip !== teamMb && dk.startsWith('team:')) {
          return false
        }
      }
      const cp = messageCounterpartyAddress(m, myAddress)
      if (!cp) {
        /** Eigene Gruppen-Sendung ohne Empfänger-Meta (API-Lücke) — in Ausgang/Alle behalten. */
        if (isMessageOutgoing(m, myAddress)) return true
        return false
      }
      return groupNorms.has(norm(cp))
    }
    if (!partnerAddress) return true
    /** Selbst an eigene Adresse: nur im eigenen Thread, nicht bei anderem Partner-Chip. */
    if (selfToSelf) {
      return norm(partnerAddress) === norm(myAddress)
    }
    const cp = messageCounterpartyAddress(m, myAddress)
    if (!cp) return false
    return norm(cp) === norm(partnerAddress)
  })
}

export function uniqueCounterpartyAddresses(messages: Message[], myAddress: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of messages) {
    const tgKeys = telegramOutboundCounterpartyKeys(m)
    if (tgKeys.length > 1) {
      for (const k of tgKeys) {
        if (isIgnoredInboxCounterpartyAddress(k)) continue
        const key = norm(k)
        if (seen.has(key)) continue
        seen.add(key)
        out.push(k)
      }
      continue
    }
    const cp = messageCounterpartyAddress(m, myAddress)
    if (!cp || isIgnoredInboxCounterpartyAddress(cp)) continue
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

export function messageTouchesTelegramTransport(m: Message): boolean {
  return m.source === 'telegram' || (Array.isArray(m.transports) && m.transports.includes('telegram'))
}

/** Nachricht über Mailbox/IOTA (nicht reiner Mesh-only-Pfad). */
export function messageTouchesInternetTransport(m: Message): boolean {
  if (messageTouchesTelegramTransport(m)) return false
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
    if (!cp || isIgnoredInboxCounterpartyAddress(cp)) continue
    const k = norm(cp)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(cp)
  }
  out.sort((a, b) => norm(a).localeCompare(norm(b)))
  return out
}
