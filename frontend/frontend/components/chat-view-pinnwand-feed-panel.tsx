'use client'

import { Megaphone, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ChatViewInboxList, type ChatViewInboxListProps } from '@/frontend/components/chat-view-inbox-list'
import { ChatViewPinnwandModerationCard } from '@/frontend/components/chat-view-pinnwand-moderation-card'
import { ChatViewPinnwandReaderBanner } from '@/frontend/components/chat-view-pinnwand-reader-banner'
import type { ApiStatus } from '@/frontend/lib/api/status'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { ChatInboxRow } from '@/frontend/features/inbox/chat-view-inbox-rows'
import { filterPinnwandFeedRows } from '@/frontend/lib/pinnwand-feed-filter'
import { pinnwandChannelTabLabel } from '@/frontend/lib/pinnwand-display'

type FeedListProps = Pick<
  ChatViewInboxListProps,
  | 'loadError'
  | 'inboxFromCache'
  | 'inboxCacheAgeMinutes'
  | 'basisUnreachable'
  | 'messages'
  | 'inboxRows'
  | 'myAddress'
  | 'contactDirectory'
  | 'isMeshVerifiedForAddress'
  | 'exportEcdhMorgPkgForMessage'
  | 'onHideInboxMessageLocal'
  | 'onPurgeInboxMessageChain'
  | 'onForwardMessage'
  | 'onReplyToMessage'
  | 'toggleProtokollMark'
  | 'protokollMarkedIds'
  | 'pinnedPinnwandIds'
  | 'onTogglePinnedPinnwand'
  | 'showPinnwandPinActions'
  | 'inboxSelectMode'
  | 'selectedInboxIds'
  | 'toggleInboxSelection'
  | 'onDismissMeshInboundBanner'
  | 'loadingMore'
  | 'loadMoreInbox'
  | 'inboxHasMore'
  | 'onAddSenderToContactBook'
  | 'onSarqNakWire'
  | 'isInboxMessageUnread'
  | 'isPinnwandInboxMessage'
  | 'sending'
>

export type ChatViewPinnwandFeedPanelProps = FeedListProps & {
  apiStatus?: ApiStatus | null
  role?: string
  canPost?: boolean
  unreadCount?: number
  loading?: boolean
  onRefresh?: () => void
  contactDirectory?: Record<string, ContactMeshEntryClient>
}

export function ChatViewPinnwandFeedPanel(p: ChatViewPinnwandFeedPanelProps) {
  const {
    apiStatus,
    role,
    canPost = false,
    unreadCount = 0,
    loading = false,
    onRefresh,
    contactDirectory = {},
    messages,
    inboxRows,
    isPinnwandInboxMessage,
    ...listProps
  } = p

  const title = pinnwandChannelTabLabel(role, apiStatus ?? null)
  const feedRows = useMemo(
    () => filterPinnwandFeedRows(inboxRows, isPinnwandInboxMessage),
    [inboxRows, isPinnwandInboxMessage]
  )
  const feedMessages = useMemo(() => {
    if (!isPinnwandInboxMessage) return []
    return messages.filter((m) => isPinnwandInboxMessage(m))
  }, [messages, isPinnwandInboxMessage])
  const empty = feedRows.length === 0 && !p.loadError

  return (
    <section
      className="rounded-xl border-2 border-orange-500/45 bg-gradient-to-b from-orange-500/10 to-card shadow-sm"
      aria-label={title}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-500/30 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Megaphone className="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-300" aria-hidden />
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount} neu
            </span>
          ) : null}
        </div>
        {onRefresh ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-orange-500/40 text-xs"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Aktualisieren
          </Button>
        ) : null}
      </div>

      <div className="space-y-3 px-3 py-3">
        {canPost ? (
          <ChatViewPinnwandModerationCard
            apiStatus={apiStatus}
            contactDirectory={contactDirectory}
            canPost={canPost}
          />
        ) : (
          <ChatViewPinnwandReaderBanner unreadCount={unreadCount} />
        )}

        {empty ? (
          <div className="rounded-lg border border-dashed border-orange-500/35 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
            Noch keine Pinnwand-Meldungen.{' '}
            {canPost ? 'Unten eine Nachricht verfassen.' : 'Die Führung postet hier Einsatz-Updates.'}
          </div>
        ) : (
          <div className="max-h-[min(70vh,42rem)] overflow-y-auto rounded-lg border border-orange-500/25 bg-card/80">
            <ChatViewInboxList
              {...listProps}
              messages={feedMessages}
              inboxRows={feedRows}
              contactDirectory={contactDirectory}
              isPinnwandInboxMessage={isPinnwandInboxMessage}
              inboxVisibilityHint={null}
            />
          </div>
        )}
      </div>
    </section>
  )
}
