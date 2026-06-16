import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import {
  formatContactDirectoryKey,
  isDisplayableContactStorageKey,
} from '@/frontend/lib/contact-storage-key'
import { isIgnoredInboxCounterpartyAddress } from '@/frontend/features/inbox/inbox-partner-filter'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import type { InboxPartnerOption } from '@/frontend/components/chat-view-inbox-partner-strip'
import { contactReachableOnSendPath } from '@/frontend/lib/contact-send-path'
import type { ActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'

export type ConversationSidebarContactItem = {
  kind: 'contact'
  key: string
  address: string
  entry?: ContactMeshEntryClient
  displayName: string
  subtitle: string
  unreadCount: number
  isFavorite: boolean
  lastContactedAt: number
}

export type ConversationSidebarGroupItem = {
  kind: 'group'
  key: string
  groupId: string
  displayName: string
  memberCount: number
}

export type ConversationSidebarItem = ConversationSidebarContactItem | ConversationSidebarGroupItem

export function resolveContactSidebarDisplayName(
  directory: Record<string, ContactMeshEntryClient>,
  address: string,
  entry?: ContactMeshEntryClient
): string {
  const label = contactDisplayLabel(directory, address)
  if (label) return label
  const e = entry ?? directory[address]
  const tg = e?.telegramChatId?.trim()
  if (tg) return `Telegram ${tg}`
  const mesh = e?.meshNodeId?.trim()
  if (mesh) return `Funk ${mesh}`
  if (address.startsWith('tg:')) return formatContactDirectoryKey(address)
  if (/^0x[a-f0-9]{64}$/i.test(address)) return maskWalletAddress(address, 8, 6)
  return address
}

export function resolveContactSidebarSubtitle(
  directory: Record<string, ContactMeshEntryClient>,
  address: string,
  entry?: ContactMeshEntryClient
): string {
  const e = entry ?? directory[address]
  const parts: string[] = []
  if (/^0x[a-f0-9]{64}$/i.test(address)) parts.push(maskWalletAddress(address, 6, 4))
  if (e?.telegramChatId?.trim()) parts.push(`TG ${e.telegramChatId.trim()}`)
  if (e?.meshNodeId?.trim()) parts.push(`Funk ${e.meshNodeId.trim()}`)
  return parts.join(' · ') || address
}

export function buildConversationSidebarContacts(p: {
  directory: Record<string, ContactMeshEntryClient>
  partnerOptions: readonly InboxPartnerOption[]
  favorites: ReadonlySet<string>
  lastContacted: Readonly<Record<string, number>>
  hidden: ReadonlySet<string>
  sendPath?: ActiveSendPath
}): ConversationSidebarContactItem[] {
  const byKey = new Map<string, ConversationSidebarContactItem>()

  for (const [addr, entry] of Object.entries(p.directory)) {
    const address = addr.trim().toLowerCase()
    if (!address || p.hidden.has(address) || !isDisplayableContactStorageKey(address)) continue
    byKey.set(address, {
      kind: 'contact',
      key: `contact:${address}`,
      address,
      entry,
      displayName: resolveContactSidebarDisplayName(p.directory, address, entry),
      subtitle: resolveContactSidebarSubtitle(p.directory, address, entry),
      unreadCount: 0,
      isFavorite: p.favorites.has(address),
      lastContactedAt: p.lastContacted[address] ?? 0,
    })
  }

  /** Nur Unread aus Posteingang — keine Adressen ohne Telefonbuch-Eintrag in der Chat-Liste. */
  for (const opt of p.partnerOptions) {
    const address = opt.address.trim().toLowerCase()
    if (!address || p.hidden.has(address) || isIgnoredInboxCounterpartyAddress(address)) continue
    const existing = byKey.get(address)
    if (!existing) continue
    existing.unreadCount = opt.unreadCount ?? 0
  }

  const items = Array.from(byKey.values()).filter((item) =>
    p.sendPath ? contactReachableOnSendPath(item.address, item.entry, p.sendPath) : true
  )

  return items.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
    if (a.lastContactedAt !== b.lastContactedAt) return b.lastContactedAt - a.lastContactedAt
    return a.displayName.localeCompare(b.displayName, 'de')
  })
}

export function buildConversationSidebarGroups(
  groups: readonly MessengerGroupDefinition[]
): ConversationSidebarGroupItem[] {
  return groups.map((g) => ({
    kind: 'group',
    key: `group:${g.id}`,
    groupId: g.id,
    displayName: g.name,
    memberCount: g.memberAddresses.length,
  }))
}
