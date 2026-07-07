'use client'

/**
 * Posteingang als zusammenhängende Einheit: Kopfleiste + scrollbare Liste (Fehler/Leer/Zeilen).
 * Ergänzt `ChatViewInboxList` (Zeileninhalt) und `ChatViewInboxToolbar` (Aktionen) – die View orchestriert nur noch Daten.
 */

import { useEffect, type ComponentProps } from 'react'
import { ChatViewInboxList } from '@/frontend/components/chat-view-inbox-list'
import {
  ChatViewInboxPartnerStrip,
  type InboxPartnerOption,
} from '@/frontend/components/chat-view-inbox-partner-strip'
import { ChatViewInboxToolbar } from '@/frontend/components/chat-view-inbox-toolbar'
import type { InboxDirectionFilter } from '@/frontend/features/inbox/inbox-partner-filter'
import type { InboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import type { InboxSourceFilter } from '@/frontend/lib/inbox-source-filter'
import type { InboxFeedReadPort } from '@/frontend/features/messenger-ports'
import { ChatViewInboxOutgoingHandshakeRequests } from '@/frontend/components/chat-view-inbox-outgoing-handshake-requests'
import { ChatViewInboxHandshakeRequests } from '@/frontend/components/chat-view-inbox-handshake-requests'
import { ChatViewInboxCategoryChips } from '@/frontend/components/chat-view-inbox-category-chips'
import type { InboxOverviewCategory } from '@/frontend/lib/inbox-overview-filter'
import type { Message } from '@/frontend/lib/types'
import type { OutgoingHandshakeOffer, PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import type { HandshakeOfferSource } from '@/frontend/lib/handshake-offer-delete'
import { messageMatchesInboxSearch } from '@/frontend/lib/inbox-unified-search'
import type { ChatInboxRow } from '@/frontend/features/inbox/chat-view-inbox-rows'
import { ChatViewConversationMenu, type ChatViewConversationMenuProps } from '@/frontend/components/chat-view-conversation-menu'
import { InboxTeamSyncSystemCards } from '@/frontend/components/inbox-team-sync-system-cards'
import { InboxTelegramAlarmGroupJoinStrip } from '@/frontend/components/inbox-telegram-alarm-group-join-strip'
import { syncJoinRequestsFromInboxMessages } from '@/frontend/lib/team-join-request-store'

type InboxListRest = Omit<ComponentProps<typeof ChatViewInboxList>, keyof InboxFeedReadPort>
type InboxToolbarRest = Omit<
  ComponentProps<typeof ChatViewInboxToolbar>,
  | 'selectedInboxCount'
  | 'showWireControls'
  | 'onToggleWireControls'
  | 'showChannelControls'
  | 'onToggleChannelControls'
  | 'showPartnerControls'
  | 'onTogglePartnerControls'
  | 'hasHiddenMessages'
  | 'onToggleHideAllVisibleLocal'
  | keyof InboxFeedReadPort
>

/** `selectedInboxCount` wird aus `selectedInboxIds` im Panel abgeleitet. */
export type ChatViewInboxPanelProps = InboxFeedReadPort &
  InboxListRest &
  InboxToolbarRest & {
    hiddenInboxCount: number
    onToggleHideAllVisibleLocal: () => void
    inboxPartnerOptions: InboxPartnerOption[]
    inboxPartnerKey: string | null
    setInboxPartnerKey: (k: string | null) => void
    inboxDirectionFilter: InboxDirectionFilter
    setInboxDirectionFilter: (d: InboxDirectionFilter) => void
    inboxSourceFilter: InboxSourceFilter
    setInboxSourceFilter: (f: InboxSourceFilter) => void
    inboxChannelFiltersArmed: boolean
    setInboxChannelFiltersArmed: (v: boolean) => void
    inboxWireFiltersArmed: boolean
    setInboxWireFiltersArmed: (v: boolean) => void
    inboxPartnerFiltersArmed: boolean
    setInboxPartnerFiltersArmed: (v: boolean) => void
    inboxWireFilter: InboxWireFilter
    setInboxWireFilter: (f: InboxWireFilter) => void
    selectInboxPartnerForSend: (address: string) => void
    removeInboxPartnerFromQuickList: (
      address: string,
      opts?: { hideMatchingMessages?: boolean; messageTransport?: 'mesh' | 'iota' | 'all' }
    ) => void
    onOpenPhonebook?: () => void
    showPhonebookButton?: boolean
    pendingHandshakeOffers?: PendingHandshakeOffer[]
    outgoingHandshakeOffers?: OutgoingHandshakeOffer[]
    pendingHandshakesLoading?: boolean
    sending?: boolean
    onAcceptPendingHandshake?: (sender: string) => void | Promise<void>
    onUseSenderAsPartnerFromInbox?: (sender: string) => void
    onReplyToMessage?: (msg: Message) => void
    onDeleteIncomingHandshake?: (
      sender: string,
      nonce: string,
      source: HandshakeOfferSource
    ) => void | Promise<void>
    onDeleteOutgoingHandshake?: (
      recipient: string,
      nonce: string,
      source: HandshakeOfferSource
    ) => void | Promise<void>
    onResendOutgoingHandshake?: (recipient: string) => void | Promise<void>
    pendingHandshakeCount?: number
    /** Hinweis wenn Mailbox/verschlüsselt geladen, aber Filter versteckt. */
    inboxVisibilityHint?: string | null
    mailboxesPanelOpen?: boolean
    onToggleMailboxesPanel?: () => void
    apiStatus?: ApiStatus | null
    contactDirectory?: Record<string, ContactMeshEntryClient>
    onContactsChanged?: () => void
    onMailboxPanelStatus?: (msg: string, kind: 'success' | 'error') => void
    onApplySendRecipient?: (walletAddress: string) => void
    /** Sidebar ersetzt Partner-Chips (Telegram-Layout). */
    hidePartnerStrip?: boolean
    /** Aktiver 1:1-Thread: Overview-Chips ausblenden. */
    hideOverviewChips?: boolean
    showInboxIotaFilter?: boolean
    inboxSearchQuery?: string
    conversationMenu?: ChatViewConversationMenuProps
    showIotaExpertInboxActions?: boolean
    showInboxPackageExpertMenu?: boolean
    inboxPackageExpertMenu?: React.ReactNode
    inboxOverviewChipsVisible?: boolean
    inboxOverviewCategory?: InboxOverviewCategory
    onInboxOverviewCategoryChange?: (c: InboxOverviewCategory) => void
    inboxOverviewUnreadCounts?: Record<InboxOverviewCategory, number>
    pinnwandOverviewConfigured?: boolean
    isInboxMessageUnread?: (msg: Message) => boolean
    isPinnwandInboxMessage?: (msg: Message) => boolean
}

export function ChatViewInboxPanel(props: ChatViewInboxPanelProps) {
  const {
    loadError,
    inboxFromCache,
    inboxCacheAgeMinutes,
    basisUnreachable,
    messages,
    inboxRows,
    myAddress,
    contactDirectory = {},
    isMeshVerifiedForAddress,
    exportEcdhMorgPkgForMessage,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onForwardMessage,
    onToggleHideAllVisibleLocal,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    hiddenInboxCount,
    toggleInboxSelection,
    onBulkHideSelected,
    onBulkPurgeSelected,
    toggleProtokollMark,
    protokollMarkedIds,
    pinnedPinnwandIds,
    onTogglePinnedPinnwand,
    showPinnwandPinActions,
    inboxPartnerOptions,
    inboxPartnerKey,
    setInboxPartnerKey,
    inboxDirectionFilter,
    setInboxDirectionFilter,
    inboxSourceFilter,
    setInboxSourceFilter,
    inboxChannelFiltersArmed,
    setInboxChannelFiltersArmed,
    inboxWireFiltersArmed,
    setInboxWireFiltersArmed,
    inboxPartnerFiltersArmed,
    setInboxPartnerFiltersArmed,
    inboxWireFilter,
    setInboxWireFilter,
    selectInboxPartnerForSend,
    removeInboxPartnerFromQuickList,
    onDismissMeshInboundBanner,
    pendingHandshakeOffers = [],
    outgoingHandshakeOffers = [],
    pendingHandshakesLoading = false,
    sending = false,
    onAcceptPendingHandshake,
    onUseSenderAsPartnerFromInbox,
    onDeleteIncomingHandshake,
    onReplyToMessage,
    onDeleteOutgoingHandshake,
    onResendOutgoingHandshake,
    pendingHandshakeCount = 0,
    inboxVisibilityHint = null,
    mailboxesPanelOpen = false,
    onToggleMailboxesPanel,
    apiStatus = null,
    onContactsChanged,
    onMailboxPanelStatus,
    onApplySendRecipient,
    loadingMore,
    loadMoreInbox,
    inboxHasMore,
    onAddSenderToContactBook,
    onSarqNakWire,
    showInboxIotaFilter = true,
    hidePartnerStrip = false,
    hideOverviewChips = false,
    inboxSearchQuery = '',
    conversationMenu,
    showIotaExpertInboxActions = true,
    showInboxPackageExpertMenu = false,
    inboxPackageExpertMenu,
    inboxOverviewChipsVisible = false,
    inboxOverviewCategory = 'alle',
    onInboxOverviewCategoryChange,
    inboxOverviewUnreadCounts,
    pinnwandOverviewConfigured = false,
    isInboxMessageUnread,
    isPinnwandInboxMessage,
    ...toolbarProps
  } = props

  const searchQ = inboxSearchQuery.trim()
  const filteredInboxRows: ChatInboxRow[] = searchQ
    ? inboxRows.filter((row) => {
        if (row.kind === 'msg') {
          return messageMatchesInboxSearch(row.msg, searchQ, myAddress, contactDirectory)
        }
        if (row.kind === 'meshInbound') {
          const hay = `${row.hint ?? ''} ${row.error ?? ''} ${row.fromAddr ?? ''}`.toLowerCase()
          return hay.includes(searchQ.toLowerCase())
        }
        if (row.kind === 'slide') {
          return row.frames.some((f) => f.toLowerCase().includes(searchQ.toLowerCase()))
        }
        return true
      })
    : [...inboxRows]

  useEffect(() => {
    const role = (apiStatus?.role || '').trim().toLowerCase()
    if (role !== 'boss' && role !== 'kommandant') return
    const boss = (myAddress || apiStatus?.myAddressFull || apiStatus?.myAddress || '').trim()
    syncJoinRequestsFromInboxMessages(messages, boss)
  }, [messages, myAddress, apiStatus?.role, apiStatus?.myAddress, apiStatus?.myAddressFull])

  return (
    <div className="rounded-xl border border-border bg-card">
      {conversationMenu ? <ChatViewConversationMenu {...conversationMenu} /> : null}
      <ChatViewInboxToolbar
        {...toolbarProps}
        messages={messages}
        myAddress={myAddress}
        inboxSelectMode={inboxSelectMode}
        setInboxSelectMode={setInboxSelectMode}
        selectedInboxCount={selectedInboxIds.size}
        showWireControls={inboxWireFiltersArmed}
        onToggleWireControls={() => setInboxWireFiltersArmed(!inboxWireFiltersArmed)}
        showChannelControls={inboxChannelFiltersArmed}
        onToggleChannelControls={() => setInboxChannelFiltersArmed(!inboxChannelFiltersArmed)}
        showPartnerControls={inboxPartnerFiltersArmed}
        onTogglePartnerControls={() => setInboxPartnerFiltersArmed(!inboxPartnerFiltersArmed)}
        onBulkHideSelected={onBulkHideSelected}
        onBulkPurgeSelected={() => void onBulkPurgeSelected()}
        hasHiddenMessages={hiddenInboxCount > 0}
        onToggleHideAllVisibleLocal={onToggleHideAllVisibleLocal}
        apiStatus={apiStatus}
        pendingHandshakeCount={pendingHandshakeCount}
        showIotaExpertInboxActions={showIotaExpertInboxActions}
        showInboxPackageExpertMenu={showInboxPackageExpertMenu}
        inboxPackageExpertMenu={inboxPackageExpertMenu}
      />
      {!hideOverviewChips &&
      inboxOverviewChipsVisible &&
      onInboxOverviewCategoryChange &&
      inboxOverviewUnreadCounts ? (
        <ChatViewInboxCategoryChips
          category={inboxOverviewCategory}
          onCategoryChange={onInboxOverviewCategoryChange}
          unreadCounts={inboxOverviewUnreadCounts}
          showLagebild={pinnwandOverviewConfigured}
        />
      ) : null}
      {!hidePartnerStrip &&
      (inboxWireFiltersArmed || inboxChannelFiltersArmed || inboxPartnerFiltersArmed) ? (
        <ChatViewInboxPartnerStrip
          partnerOptions={inboxPartnerOptions}
          myAddressKnown={myAddress.trim().length > 0}
          partnerKey={inboxPartnerKey}
          onPartnerKeyChange={setInboxPartnerKey}
          direction={inboxDirectionFilter}
          onDirectionChange={setInboxDirectionFilter}
          sourceFilter={inboxSourceFilter}
          onSourceFilterChange={setInboxSourceFilter}
          showLagebildSource={pinnwandOverviewConfigured}
          wireFilter={inboxWireFilter}
          onWireFilterChange={setInboxWireFilter}
          onPartnerSelectForSend={selectInboxPartnerForSend}
          showWireSection={inboxWireFiltersArmed}
          showChannelSection={inboxChannelFiltersArmed}
          showPartnerSection={inboxPartnerFiltersArmed}
          onRemoveInboxPartnerFromQuickList={(address, opts) => {
            removeInboxPartnerFromQuickList(address, {
              hideMatchingMessages: opts.hideMatchingMessages,
              messageTransport: opts.messageTransport,
            })
          }}
          apiStatus={apiStatus}
        />
      ) : null}
      <InboxTelegramAlarmGroupJoinStrip />
      <div className="max-h-[min(70vh,42rem)] overflow-y-auto">
        {onAcceptPendingHandshake ? (
          <ChatViewInboxHandshakeRequests
            offers={pendingHandshakeOffers}
            loading={pendingHandshakesLoading}
            sending={sending}
            directory={contactDirectory}
            onAccept={onAcceptPendingHandshake}
            onUseAsPartner={(sender) => onUseSenderAsPartnerFromInbox?.(sender)}
            onDelete={
              onDeleteIncomingHandshake
                ? (sender, nonce, source) => void onDeleteIncomingHandshake(sender, nonce, source)
                : undefined
            }
          />
        ) : null}
        {onUseSenderAsPartnerFromInbox ? (
          <ChatViewInboxOutgoingHandshakeRequests
            offers={outgoingHandshakeOffers}
            loading={pendingHandshakesLoading}
            sending={sending}
            directory={contactDirectory}
            onUseAsPartner={onUseSenderAsPartnerFromInbox}
            onResend={onResendOutgoingHandshake}
            onDelete={onDeleteOutgoingHandshake}
          />
        ) : null}
        <InboxTeamSyncSystemCards messages={messages} myAddress={myAddress} />
        <ChatViewInboxList
          loadError={loadError}
          einsatzRpcHint={apiStatus?.rpcUrlLabel || apiStatus?.network}
        inboxFromCache={inboxFromCache}
        inboxCacheAgeMinutes={inboxCacheAgeMinutes}
          basisUnreachable={basisUnreachable}
          messages={messages}
          inboxRows={filteredInboxRows}
          myAddress={myAddress}
          contactDirectory={contactDirectory}
          isMeshVerifiedForAddress={isMeshVerifiedForAddress}
          exportEcdhMorgPkgForMessage={exportEcdhMorgPkgForMessage}
          onHideInboxMessageLocal={onHideInboxMessageLocal}
          onPurgeInboxMessageChain={onPurgeInboxMessageChain}
          onForwardMessage={onForwardMessage}
          toggleProtokollMark={toggleProtokollMark}
          protokollMarkedIds={protokollMarkedIds}
          pinnedPinnwandIds={pinnedPinnwandIds}
          onTogglePinnedPinnwand={onTogglePinnedPinnwand}
          showPinnwandPinActions={showPinnwandPinActions}
          inboxSelectMode={inboxSelectMode}
          selectedInboxIds={selectedInboxIds}
          toggleInboxSelection={toggleInboxSelection}
          onDismissMeshInboundBanner={onDismissMeshInboundBanner}
          loadingMore={loadingMore}
          loadMoreInbox={loadMoreInbox}
          inboxHasMore={inboxHasMore}
          onAddSenderToContactBook={onAddSenderToContactBook}
          onSarqNakWire={onSarqNakWire}
          isInboxMessageUnread={isInboxMessageUnread}
          isPinnwandInboxMessage={isPinnwandInboxMessage}
          inboxVisibilityHint={inboxVisibilityHint}
          onReplyToMessage={onReplyToMessage}
          sending={sending}
        />
      </div>
    </div>
  )
}
