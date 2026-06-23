'use client'

import { useMemo, useState } from 'react'
import { MessageSquare, MessageCircle, Search, User, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { InboxPartnerOption } from '@/frontend/components/chat-view-inbox-partner-strip'
import type { Message } from '@/frontend/lib/types'
import {
  buildConversationSidebarContacts,
  buildConversationSidebarGroups,
  buildConversationSidebarTelegramAlarm,
} from '@/frontend/lib/conversation-sidebar-items'
import {
  readTelegramAlarmGroupMembership,
} from '@/frontend/lib/telegram-alarm-group-prefs'
import {
  readContactFavorites,
  readContactLastContacted,
  readHiddenContacts,
} from '@/frontend/lib/contact-phonebook-meta-store'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'
import { searchInboxMessages, type InboxSearchMessageHit } from '@/frontend/lib/inbox-unified-search'
import type { PendingHandshakeOffer, OutgoingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import type { ActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'
import {
  contactHandshakeBadgeKind,
  resolveContactHandshakeStatus,
  type ContactHandshakeBadgeKind,
} from '@/frontend/lib/contact-handshake-ui'
import { ContactHandshakeBadge } from '@/frontend/components/contact-handshake-badge'

export type ChatViewMessengerSearchProps = {
  directory: Record<string, ContactMeshEntryClient>
  partnerOptions: readonly InboxPartnerOption[]
  messages: readonly Message[]
  myAddress: string
  query: string
  onQueryChange: (q: string) => void
  onSelectContact: (address: string) => void
  onSelectGroup: (groupId: string) => void
  onSelectTelegramAlarmGroup?: () => void
  onSelectMessageHit: (hit: InboxSearchMessageHit) => void
  activeSendPath?: ActiveSendPath
  connectedAddresses?: readonly string[]
  incomingHandshakeOffers?: readonly PendingHandshakeOffer[]
  outgoingHandshakeOffers?: readonly OutgoingHandshakeOffer[]
  className?: string
  compact?: boolean
  placeholder?: string
}

function formatHitTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ''
  }
}

export function ChatViewMessengerSearch(p: ChatViewMessengerSearchProps) {
  const [focused, setFocused] = useState(false)
  const q = p.query.trim()
  const showResults = focused && q.length >= 1

  const favorites = useMemo(() => readContactFavorites(), [])
  const lastContacted = useMemo(() => readContactLastContacted(), [])
  const hidden = useMemo(() => readHiddenContacts(), [])

  const contactHits = useMemo(() => {
    if (!q) return []
    const all = buildConversationSidebarContacts({
      directory: p.directory,
      partnerOptions: p.partnerOptions,
      favorites,
      lastContacted,
      hidden,
      sendPath: p.activeSendPath ?? 'internet',
    })
    const lower = q.toLowerCase()
    return all
      .filter(
        (c) =>
          c.displayName.toLowerCase().includes(lower) ||
          c.address.toLowerCase().includes(lower) ||
          c.subtitle.toLowerCase().includes(lower)
      )
      .slice(0, 8)
  }, [p.directory, p.partnerOptions, favorites, lastContacted, hidden, p.activeSendPath, q])

  const groupHits = useMemo(() => {
    if (!q) return []
    const lower = q.toLowerCase()
    const messenger = buildConversationSidebarGroups(readMessengerGroups())
      .filter((g) => g.displayName.toLowerCase().includes(lower))
    const telegram = buildConversationSidebarTelegramAlarm(readTelegramAlarmGroupMembership())
    const telegramHits =
      telegram &&
      (telegram.displayName.toLowerCase().includes(lower) ||
        telegram.subtitle.toLowerCase().includes(lower))
        ? [telegram]
        : []
    return [...telegramHits, ...messenger].slice(0, 4)
  }, [q])

  const messageHits = useMemo(
    () => searchInboxMessages(q, p.messages, p.myAddress, p.directory, 12),
    [q, p.messages, p.myAddress, p.directory]
  )

  const handshakeKindFor = (address: string): ContactHandshakeBadgeKind =>
    contactHandshakeBadgeKind(
      resolveContactHandshakeStatus({
        address,
        connectedAddresses: p.connectedAddresses ?? [],
        incomingOffers: p.incomingHandshakeOffers,
        outgoingOffers: p.outgoingHandshakeOffers,
      })
    )

  const hasHits = contactHits.length > 0 || groupHits.length > 0 || messageHits.length > 0

  return (
    <div className={cn('relative', p.className)}>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={p.query}
          onChange={(e) => p.onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder={p.placeholder ?? 'Chats, Personen, Nachrichten…'}
          className={cn(
            'w-full rounded-lg border border-border bg-background py-2 pl-8 pr-8 text-xs',
            p.compact && 'py-1.5'
          )}
          aria-label="Messenger durchsuchen"
        />
        {p.query ? (
          <button
            type="button"
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => p.onQueryChange('')}
            aria-label="Suche leeren"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </label>

      {showResults ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 max-h-[min(24rem,50vh)] overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-lg">
          {!hasHits ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Keine Treffer für „{q}“.</p>
          ) : null}

          {groupHits.length > 0 ? (
            <section className="mb-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Gruppen</p>
              {groupHits.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/70"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (g.kind === 'telegram-alarm') p.onSelectTelegramAlarmGroup?.()
                    else p.onSelectGroup(g.groupId)
                    p.onQueryChange('')
                    setFocused(false)
                  }}
                >
                  {g.kind === 'telegram-alarm' ? (
                    <MessageCircle className="h-4 w-4 shrink-0 text-sky-400" />
                  ) : (
                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{g.displayName}</span>
                </button>
              ))}
            </section>
          ) : null}

          {contactHits.length > 0 ? (
            <section className="mb-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Personen</p>
              {contactHits.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/70"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    p.onSelectContact(c.address)
                    p.onQueryChange('')
                    setFocused(false)
                  }}
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{c.displayName}</span>
                      <ContactHandshakeBadge kind={handshakeKindFor(c.address)} compact />
                    </span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">{c.subtitle}</span>
                  </span>
                </button>
              ))}
            </section>
          ) : null}

          {messageHits.length > 0 ? (
            <section>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nachrichten</p>
              {messageHits.map((hit) => (
                <button
                  key={hit.messageId}
                  type="button"
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/70"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    p.onSelectMessageHit(hit)
                    setFocused(false)
                  }}
                >
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="truncate font-medium text-foreground/90">{hit.counterpartyLabel}</span>
                      <span>{formatHitTime(hit.timestamp)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-foreground">{hit.snippet}</span>
                  </span>
                </button>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
