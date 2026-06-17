'use client'

import { useMemo, useState } from 'react'
import { BookUser, User, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { InboxPartnerOption } from '@/frontend/components/chat-view-inbox-partner-strip'
import {
  buildConversationSidebarContacts,
  buildConversationSidebarGroups,
  type ConversationSidebarItem,
} from '@/frontend/lib/conversation-sidebar-items'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import {
  readContactFavorites,
  readContactLastContacted,
  readHiddenContacts,
} from '@/frontend/lib/contact-phonebook-meta-store'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'
import {
  contactHandshakeBadgeKind,
  resolveContactHandshakeStatus,
  type ContactHandshakeBadgeKind,
} from '@/frontend/lib/contact-handshake-ui'
import { ContactHandshakeBadge } from '@/frontend/components/contact-handshake-badge'
import type { PendingHandshakeOffer, OutgoingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import type { ActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'
import {
  collectContactsForSendPath,
  sidebarAllSubtitleForSendPath,
} from '@/frontend/lib/contact-send-path'
import { ChatViewSelfProfileDialog } from '@/frontend/components/chat-view-self-profile-dialog'
import type { ChatViewMyWalletIdInlineProps } from '@/frontend/components/chat-view-my-wallet-id-inline'

export type ChatViewContactSidebarProps = {
  directory: Record<string, ContactMeshEntryClient>
  partnerOptions: readonly InboxPartnerOption[]
  activePartnerKey: string | null
  activeGroupId: string | null
  showAllActive: boolean
  onSelectAll: () => void
  onSelectSelf?: () => void
  activeSelfSelected?: boolean
  onSelectContact: (address: string) => void
  onSelectGroup: (groupId: string) => void
  onOpenGroupSettings?: () => void
  onOpenContactDetail: (address: string, entry?: ContactMeshEntryClient) => void
  onOpenPhonebook?: () => void
  searchQuery?: string
  activeSendPath?: ActiveSendPath
  connectedAddresses?: readonly string[]
  incomingHandshakeOffers?: readonly PendingHandshakeOffer[]
  outgoingHandshakeOffers?: readonly OutgoingHandshakeOffer[]
  selfProfile?: ChatViewMyWalletIdInlineProps
  className?: string
}

function SidebarRow(p: {
  title: string
  subtitle?: string
  active: boolean
  unreadCount?: number
  handshakeBadge?: ContactHandshakeBadgeKind
  icon?: React.ReactNode
  onClick: () => void
  onDoubleClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      onDoubleClick={p.onDoubleClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors',
        p.active ? 'bg-primary/15 text-foreground' : 'text-foreground hover:bg-muted/60'
      )}
    >
      {p.icon ? (
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          {p.icon}
        </span>
      ) : (
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50 text-sm font-semibold uppercase text-muted-foreground">
          {p.title.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{p.title}</span>
          {p.handshakeBadge ? <ContactHandshakeBadge kind={p.handshakeBadge} compact /> : null}
          {(p.unreadCount ?? 0) > 0 ? (
            <span className="ml-auto inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-4 text-white">
              {p.unreadCount! > 99 ? '99+' : p.unreadCount}
            </span>
          ) : null}
        </span>
        {p.subtitle ? (
          <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">{p.subtitle}</span>
        ) : null}
      </span>
    </button>
  )
}

export function ChatViewContactSidebar(p: ChatViewContactSidebarProps) {
  const [selfProfileOpen, setSelfProfileOpen] = useState(false)
  const favorites = useMemo(() => readContactFavorites(), [])
  const lastContacted = useMemo(() => readContactLastContacted(), [])
  const hidden = useMemo(() => readHiddenContacts(), [])

  const contacts = useMemo(
    () =>
      buildConversationSidebarContacts({
        directory: p.directory,
        partnerOptions: p.partnerOptions,
        favorites,
        lastContacted,
        hidden,
        sendPath: p.activeSendPath ?? 'internet',
      }),
    [p.directory, p.partnerOptions, favorites, lastContacted, hidden, p.activeSendPath]
  )

  const sendPathContactCount = useMemo(
    () =>
      p.activeSendPath
        ? collectContactsForSendPath({
            directory: p.directory,
            partnerOptions: p.partnerOptions,
            path: p.activeSendPath,
            hidden,
          }).length
        : 0,
    [p.directory, p.partnerOptions, p.activeSendPath, hidden]
  )

  const groups = useMemo(() => buildConversationSidebarGroups(readMessengerGroups()), [])

  const selfAddress = (p.selfProfile?.myAddressLine || '').trim()
  const selfSubtitle = /^0x[a-fA-F0-9]{64}$/i.test(selfAddress)
    ? maskWalletAddress(selfAddress, 8, 6)
    : 'Kontakt-ID & QR'

  const q = (p.searchQuery ?? '').trim().toLowerCase()
  const filterItem = (item: ConversationSidebarItem) => {
    if (!q) return true
    if (item.kind === 'group') {
      return item.displayName.toLowerCase().includes(q)
    }
    return (
      item.displayName.toLowerCase().includes(q) ||
      item.address.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q)
    )
  }

  const filteredContacts = contacts.filter(filterItem)
  const filteredGroups = groups.filter(filterItem)
  const showSelfRow =
    p.selfProfile &&
    (!q ||
      q === 'ich' ||
      'ich'.startsWith(q) ||
      selfAddress.toLowerCase().includes(q) ||
      selfSubtitle.toLowerCase().includes(q))

  const openSelfProfile = () => setSelfProfileOpen(true)

  const handleSelectSelf = () => {
    p.onSelectSelf?.()
  }

  const handshakeKindFor = (address: string): ContactHandshakeBadgeKind => {
    const status = resolveContactHandshakeStatus({
      address,
      connectedAddresses: p.connectedAddresses ?? [],
      incomingOffers: p.incomingHandshakeOffers,
      outgoingOffers: p.outgoingHandshakeOffers,
    })
    return contactHandshakeBadgeKind(status)
  }

  return (
    <>
      <aside
        className={cn(
          'flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-border bg-card/40',
          p.className
        )}
        aria-label="Konversationen"
      >
        <div className="border-b border-border px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-foreground">Chats</h2>
            {p.onOpenPhonebook ? (
              <button
                type="button"
                onClick={p.onOpenPhonebook}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                title="Telefonbuch"
              >
                <BookUser className="h-4 w-4 shrink-0" aria-hidden />
                Telefonbuch
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {showSelfRow ? (
            <SidebarRow
              title="Ich"
              subtitle={selfSubtitle}
              active={p.activeSelfSelected === true}
              icon={<User className="h-5 w-5" />}
              onClick={handleSelectSelf}
              onDoubleClick={openSelfProfile}
            />
          ) : null}

          <SidebarRow
            title="Alle"
            subtitle={
              p.activeSendPath
                ? sidebarAllSubtitleForSendPath(p.activeSendPath, sendPathContactCount)
                : 'Gesamter Posteingang'
            }
            active={p.showAllActive}
            onClick={p.onSelectAll}
          />

          {filteredGroups.length > 0 ? (
            <section className="mt-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Gruppen
              </p>
              {filteredGroups.map((g) => (
                <SidebarRow
                  key={g.key}
                  title={g.displayName}
                  subtitle={`${g.memberCount} Mitglieder`}
                  active={p.activeGroupId === g.groupId}
                  icon={<Users className="h-4 w-4" />}
                  onClick={() => p.onSelectGroup(g.groupId)}
                  onDoubleClick={() => p.onOpenGroupSettings?.()}
                />
              ))}
            </section>
          ) : null}

          <section className="mt-2">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Kontakte
            </p>
            {filteredContacts.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                {p.activeSendPath
                  ? 'Keine Kontakte mit Adresse für diesen Sendepfad — Telefonbuch ergänzen.'
                  : 'Keine Kontakte — Telefonbuch öffnen und anlegen.'}
              </p>
            ) : (
              filteredContacts.map((c) => (
                <SidebarRow
                  key={c.key}
                  title={c.displayName}
                  subtitle={c.subtitle}
                  active={p.activePartnerKey != null && p.activePartnerKey.toLowerCase() === c.address.toLowerCase()}
                  unreadCount={c.unreadCount}
                  handshakeBadge={handshakeKindFor(c.address)}
                  onClick={() => p.onSelectContact(c.address)}
                  onDoubleClick={() => p.onOpenContactDetail(c.address, c.entry)}
                />
              ))
            )}
          </section>
        </div>

        <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <BookUser className="h-3 w-3" aria-hidden />
            Doppelklick Kontakt → Details · Gruppe → Verwalten · „Ich“ → Profil
          </span>
        </div>
      </aside>

      {p.selfProfile ? (
        <ChatViewSelfProfileDialog
          {...p.selfProfile}
          open={selfProfileOpen}
          onOpenChange={setSelfProfileOpen}
        />
      ) : null}
    </>
  )
}
