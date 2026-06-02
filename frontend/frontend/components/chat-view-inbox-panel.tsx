'use client'

/**
 * Posteingang als zusammenhängende Einheit: Kopfleiste + scrollbare Liste (Fehler/Leer/Zeilen).
 * Ergänzt `ChatViewInboxList` (Zeileninhalt) und `ChatViewInboxToolbar` (Aktionen) – die View orchestriert nur noch Daten.
 */

import type { ComponentProps } from 'react'
import { useState } from 'react'
import { ChatViewInboxList } from '@/frontend/components/chat-view-inbox-list'
import {
  ChatViewInboxPartnerStrip,
  type InboxPartnerOption,
} from '@/frontend/components/chat-view-inbox-partner-strip'
import { ChatViewInboxToolbar } from '@/frontend/components/chat-view-inbox-toolbar'
import type { InboxDirectionFilter } from '@/frontend/features/inbox/inbox-partner-filter'
import type { InboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import type { InboxFeedReadPort } from '@/frontend/features/messenger-ports'
import { ChatViewInboxOutgoingHandshakeRequests } from '@/frontend/components/chat-view-inbox-outgoing-handshake-requests'
import type { OutgoingHandshakeOffer, PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import type { HandshakeOfferSource } from '@/frontend/lib/handshake-offer-delete'

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
    inboxMeshTransportOnly: boolean
    setInboxMeshTransportOnly: (v: boolean) => void
    inboxIotaTransportOnly: boolean
    setInboxIotaTransportOnly: (v: boolean) => void
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
    showInboxIotaFilter?: boolean
    showIotaExpertInboxActions?: boolean
  }

export function ChatViewInboxPanel(props: ChatViewInboxPanelProps) {
  const [showWireControls, setShowWireControls] = useState(false)
  const [showChannelControls, setShowChannelControls] = useState(false)
  const [showPartnerControls, setShowPartnerControls] = useState(false)
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
    inboxMeshTransportOnly,
    setInboxMeshTransportOnly,
    inboxIotaTransportOnly,
    setInboxIotaTransportOnly,
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
    showIotaExpertInboxActions = true,
    ...toolbarProps
  } = props

  return (
    <div className="rounded-xl border border-border bg-card">
      <ChatViewInboxToolbar
        {...toolbarProps}
        messages={messages}
        myAddress={myAddress}
        inboxSelectMode={inboxSelectMode}
        setInboxSelectMode={setInboxSelectMode}
        selectedInboxCount={selectedInboxIds.size}
        showWireControls={showWireControls}
        onToggleWireControls={() => setShowWireControls((v) => !v)}
        showChannelControls={showChannelControls}
        onToggleChannelControls={() => setShowChannelControls((v) => !v)}
        showPartnerControls={showPartnerControls}
        onTogglePartnerControls={() => setShowPartnerControls((v) => !v)}
        onBulkHideSelected={onBulkHideSelected}
        onBulkPurgeSelected={() => void onBulkPurgeSelected()}
        hasHiddenMessages={hiddenInboxCount > 0}
        onToggleHideAllVisibleLocal={onToggleHideAllVisibleLocal}
        apiStatus={apiStatus}
        pendingHandshakeCount={pendingHandshakeCount}
        showIotaExpertInboxActions={showIotaExpertInboxActions}
      />
      {showWireControls || showChannelControls || showPartnerControls ? (
        <ChatViewInboxPartnerStrip
          partnerOptions={inboxPartnerOptions}
          myAddressKnown={myAddress.trim().length > 0}
          partnerKey={inboxPartnerKey}
          onPartnerKeyChange={setInboxPartnerKey}
          direction={inboxDirectionFilter}
          onDirectionChange={setInboxDirectionFilter}
          meshTransportOnly={inboxMeshTransportOnly}
          onMeshTransportOnlyChange={setInboxMeshTransportOnly}
          iotaTransportOnly={inboxIotaTransportOnly}
          onIotaTransportOnlyChange={setInboxIotaTransportOnly}
          showInboxIotaFilter={showInboxIotaFilter}
          wireFilter={inboxWireFilter}
          onWireFilterChange={setInboxWireFilter}
          onPartnerSelectForSend={selectInboxPartnerForSend}
          showWireSection={showWireControls}
          showChannelSection={showChannelControls}
          showPartnerSection={showPartnerControls}
          onRemoveInboxPartnerFromQuickList={(address, opts) => {
            removeInboxPartnerFromQuickList(address, {
              hideMatchingMessages: opts.hideMatchingMessages,
              messageTransport: opts.messageTransport,
            })
          }}
        />
      ) : null}
      <div className="max-h-[min(70vh,42rem)] overflow-y-auto">
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
        <ChatViewInboxList
          loadError={loadError}
        inboxFromCache={inboxFromCache}
        inboxCacheAgeMinutes={inboxCacheAgeMinutes}
          basisUnreachable={basisUnreachable}
          messages={messages}
          inboxRows={inboxRows}
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
          inboxVisibilityHint={inboxVisibilityHint}
          pendingHandshakeOffers={pendingHandshakeOffers}
          onAcceptPendingHandshake={onAcceptPendingHandshake}
          onUseSenderAsPartnerFromInbox={onUseSenderAsPartnerFromInbox}
          sending={sending}
        />
      </div>
    </div>
  )
}
