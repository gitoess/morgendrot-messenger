'use client'

import { useMemo, useState } from 'react'
import { BookUser, Plus, Search, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { InboxPartnerOption } from '@/frontend/components/chat-view-inbox-partner-strip'
import {
  buildConversationSidebarContacts,
  buildConversationSidebarGroups,
  type ConversationSidebarItem,
} from '@/frontend/lib/conversation-sidebar-items'
import {
  readContactFavorites,
  readContactLastContacted,
  readHiddenContacts,
} from '@/frontend/lib/contact-phonebook-meta-store'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'

export type ChatViewContactSidebarProps = {
  directory: Record<string, ContactMeshEntryClient>
  partnerOptions: readonly InboxPartnerOption[]
  activePartnerKey: string | null
  activeGroupId: string | null
  showAllActive: boolean
  onSelectAll: () => void
  onSelectContact: (address: string) => void
  onSelectGroup: (groupId: string) => void
  onOpenContactDetail: (address: string, entry?: ContactMeshEntryClient) => void
  onOpenPhonebook?: () => void
  className?: string
}

function SidebarRow(p: {
  title: string
  subtitle?: string
  active: boolean
  unreadCount?: number
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
        'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
        p.active ? 'bg-primary/15 text-foreground' : 'text-foreground hover:bg-muted/60'
      )}
    >
      {p.icon ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          {p.icon}
        </span>
      ) : (
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
          {p.title.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{p.title}</span>
          {(p.unreadCount ?? 0) > 0 ? (
            <span className="ml-auto inline-flex min-w-[1.1rem] shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-4 text-white">
              {p.unreadCount! > 99 ? '99+' : p.unreadCount}
            </span>
          ) : null}
        </span>
        {p.subtitle ? <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">{p.subtitle}</span> : null}
      </span>
    </button>
  )
}

export function ChatViewContactSidebar(p: ChatViewContactSidebarProps) {
  const [search, setSearch] = useState('')
  const [metaTick] = useState(0)

  const favorites = useMemo(() => readContactFavorites(), [metaTick])
  const lastContacted = useMemo(() => readContactLastContacted(), [metaTick])
  const hidden = useMemo(() => readHiddenContacts(), [metaTick])

  const contacts = useMemo(
    () =>
      buildConversationSidebarContacts({
        directory: p.directory,
        partnerOptions: p.partnerOptions,
        favorites,
        lastContacted,
        hidden,
      }),
    [p.directory, p.partnerOptions, favorites, lastContacted, hidden]
  )

  const groups = useMemo(() => buildConversationSidebarGroups(readMessengerGroups()), [])

  const q = search.trim().toLowerCase()
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

  return (
    <aside
      className={cn(
        'flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-border bg-card/40',
        p.className
      )}
      aria-label="Konversationen"
    >
      <div className="border-b border-border px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Chats</h2>
          {p.onOpenPhonebook ? (
            <button
              type="button"
              onClick={p.onOpenPhonebook}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Telefonbuch öffnen"
              aria-label="Telefonbuch öffnen"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-2 text-xs"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <SidebarRow
          title="Alle"
          subtitle="Gesamter Posteingang"
          active={p.showAllActive}
          onClick={p.onSelectAll}
        />

        {filteredGroups.length > 0 ? (
          <section className="mt-2">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Gruppen</p>
            {filteredGroups.map((g) => (
              <SidebarRow
                key={g.key}
                title={g.displayName}
                subtitle={`${g.memberCount} Mitglieder`}
                active={p.activeGroupId === g.groupId}
                icon={<Users className="h-4 w-4" />}
                onClick={() => p.onSelectGroup(g.groupId)}
              />
            ))}
          </section>
        ) : null}

        <section className="mt-2">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kontakte</p>
          {filteredContacts.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">Keine Kontakte — Telefonbuch öffnen und anlegen.</p>
          ) : (
            filteredContacts.map((c) => (
              <SidebarRow
                key={c.key}
                title={c.displayName}
                subtitle={c.subtitle}
                active={p.activePartnerKey != null && p.activePartnerKey.toLowerCase() === c.address.toLowerCase()}
                unreadCount={c.unreadCount}
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
          Doppelklick auf Kontakt → Details &amp; Medien
        </span>
      </div>
    </aside>
  )
}
