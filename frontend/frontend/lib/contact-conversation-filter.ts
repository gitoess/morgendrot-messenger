import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { lookupContactEntry } from '@/frontend/lib/contact-display'
import {
  filterInboxMessagesByPartnerAndDirection,
  messageCounterpartyAddress,
  messageTouchesMeshTransport,
  type InboxPartnerFilterOpts,
} from '@/frontend/features/inbox/inbox-partner-filter'
import { MORG_PINNWAND_V1_PREFIX } from '@/frontend/lib/pinnwand-post-marker'
import type { Message } from '@/frontend/lib/types'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export type ContactConversationMatch = {
  iotaAddress: string | null
  telegramChatIds: string[]
  meshNodeIds: string[]
}

function linkedIotaAddressForContact(
  directory: Record<string, ContactMeshEntryClient>,
  storageKey: string,
  entry?: ContactMeshEntryClient
): string | null {
  const key = storageKey.trim().toLowerCase()
  if (/^0x[a-f0-9]{64}$/.test(key)) return key
  if (!entry) return null
  const tg = entry.telegramChatId?.trim()
  const mesh = entry.meshNodeId?.trim()
  const label = entry.label?.trim().toLowerCase()
  for (const [addr, e] of Object.entries(directory)) {
    const a = addr.trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(a)) continue
    if (e === entry) return a
    if (tg && e.telegramChatId?.trim() === tg) return a
    if (mesh && e.meshNodeId?.trim() === mesh) return a
    if (label && e.label?.trim().toLowerCase() === label) return a
  }
  return null
}

/** Alle Erreichbarkeiten eines Kontakts für 1:1-Thread-Filter (IOTA, Telegram, Funk). */
export function buildContactConversationMatch(
  storageKey: string,
  entry?: ContactMeshEntryClient,
  directory?: Record<string, ContactMeshEntryClient>
): ContactConversationMatch {
  const key = storageKey.trim().toLowerCase()
  const linkedIota =
    directory && !/^0x[a-f0-9]{64}$/.test(key)
      ? linkedIotaAddressForContact(directory, storageKey, entry)
      : null
  const telegramChatIds = new Set<string>()
  if (key.startsWith('tg:')) {
    telegramChatIds.add(key)
    telegramChatIds.add(key.slice(3))
  }
  const tid = entry?.telegramChatId?.trim()
  if (tid) {
    telegramChatIds.add(`tg:${tid}`)
    telegramChatIds.add(tid)
  }
  const meshNodeIds = entry?.meshNodeId?.trim() ? [entry.meshNodeId.trim()] : []
  const iotaAddress = /^0x[a-f0-9]{64}$/.test(key) ? key : linkedIota
  return {
    iotaAddress,
    telegramChatIds: [...telegramChatIds],
    meshNodeIds,
  }
}

export function resolveContactConversationMatch(
  storageKey: string,
  directory: Record<string, ContactMeshEntryClient>
): ContactConversationMatch {
  const entry = lookupContactEntry(directory, storageKey)
  return buildContactConversationMatch(storageKey, entry, directory)
}

function telegramIdMatches(counterparty: string, ids: readonly string[]): boolean {
  const cp = norm(counterparty)
  for (const raw of ids) {
    const t = norm(raw)
    if (!t) continue
    if (cp === t) return true
    const bare = t.startsWith('tg:') ? t.slice(3) : t
    if (cp === `tg:${bare}` || cp === bare) return true
  }
  return false
}

/** Gruppen-Broadcast und Pinnwand-Posts gehören nicht in den 1:1-Kontakt-Thread. */
export function isExcludedFromDirectContactThread(msg: Message): boolean {
  const dk = msg.dedupKey?.trim() ?? ''
  if (dk.startsWith('team:')) return true
  const content = `${msg.content ?? ''}`
  if (content.includes(MORG_PINNWAND_V1_PREFIX)) return true
  return false
}

export function messageMatchesContactConversation(
  msg: Message,
  myAddress: string,
  match: ContactConversationMatch
): boolean {
  if (isExcludedFromDirectContactThread(msg)) return false

  const hasIota = Boolean(match.iotaAddress)
  const hasTg = match.telegramChatIds.length > 0
  const hasMesh = match.meshNodeIds.length > 0
  if (!hasIota && !hasTg && !hasMesh) return false

  const cp = messageCounterpartyAddress(msg, myAddress)
  if (cp) {
    if (hasIota && match.iotaAddress && norm(cp) === norm(match.iotaAddress)) return true
    if (hasTg && telegramIdMatches(cp, match.telegramChatIds)) return true
  }

  if (messageTouchesMeshTransport(msg) && hasMesh) {
    const from = (msg.from ?? '').trim()
    for (const node of match.meshNodeIds) {
      if (from.includes(node)) return true
    }
    if (hasIota && match.iotaAddress && cp && norm(cp) === norm(match.iotaAddress)) return true
  }

  return false
}

export type ContactConversationFilterOpts = InboxPartnerFilterOpts & {
  contactMatch?: ContactConversationMatch
}

export function filterInboxMessagesForContactConversation(
  messages: Message[],
  myAddress: string,
  partnerAddress: string | null,
  direction: 'all' | 'in' | 'out' = 'all',
  opts?: ContactConversationFilterOpts
): Message[] {
  if (opts?.contactMatch) {
    return messages.filter((m) => {
      if (direction === 'in' && messageCounterpartyAddress(m, myAddress) === null) {
        /* keep mesh inbound */
      } else if (direction === 'in') {
        const outgoing =
          myAddress.trim() &&
          norm(m.from ?? '') === norm(myAddress) &&
          !(
            m.recipient?.trim() &&
            norm(m.recipient) === norm(myAddress) &&
            norm(m.from ?? '') === norm(myAddress)
          )
        if (outgoing) return false
      } else if (direction === 'out') {
        if (!myAddress.trim() || norm(m.from ?? '') !== norm(myAddress)) return false
      }
      return messageMatchesContactConversation(m, myAddress, opts.contactMatch!)
    })
  }
  return filterInboxMessagesByPartnerAndDirection(messages, myAddress, partnerAddress, direction, opts)
}

export function messagesForContactConversation(
  messages: readonly Message[],
  myAddress: string,
  storageKey: string,
  entry?: ContactMeshEntryClient,
  directory?: Record<string, ContactMeshEntryClient>
): Message[] {
  const match = directory
    ? resolveContactConversationMatch(storageKey, directory)
    : buildContactConversationMatch(storageKey, entry)
  return filterInboxMessagesForContactConversation([...messages], myAddress, storageKey, 'all', {
    contactMatch: match,
  })
}
