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
import { ChatViewInboxHandshakeRequests } from '@/frontend/components/chat-view-inbox-handshake-requests'
import { ChatViewInboxOutgoingHandshakeRequests } from '@/frontend/components/chat-view-inbox-outgoing-handshake-requests'
import type { OutgoingHandshakeOffer, PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { ChatViewMyMailboxesPanel } from '@/frontend/components/chat-view-my-mailboxes-panel'
import { ChatViewEinsatzProfilImportDialog } from '@/frontend/components/chat-view-einsatz-profil-import-dialog'
import { canAccessEinsatzleitung, canCreateTeamMailbox } from '@/frontend/lib/messenger-role-capabilities'
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
    /** Boss/Kommandant: Einsatzleitung-Tab im Dashboard. */
    onOpenEinsatzleitung?: () => void
    showInboxIotaFilter?: boolean
    showIotaExpertInboxActions?: boolean
  }

export function ChatViewInboxPanel(props: ChatViewInboxPanelProps) {
  const [showWireControls, setShowWireControls] = useState(false)
  const [showChannelControls, setShowChannelControls] = useState(false)
  const [showPartnerControls, setShowPartnerControls] = useState(false)
  const [bossImportOpen, setBossImportOpen] = useState(false)
  const {
    loadError,
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
    onDeleteIncomingHandshake,
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
    onOpenEinsatzleitung,
    showInboxIotaFilter = true,
    showIotaExpertInboxActions = true,
    ...toolbarProps
  } = props

  const roleLine = (apiStatus?.role || '').trim()
  const showEinsatzleitungActions = canAccessEinsatzleitung(roleLine)

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
        mailboxesPanelOpen={mailboxesPanelOpen}
        onToggleMailboxesPanel={onToggleMailboxesPanel}
        apiStatus={apiStatus}
        pendingHandshakeCount={pendingHandshakeCount}
        isBossRole={showEinsatzleitungActions}
        onOpenBossEinsatzleitung={onOpenEinsatzleitung}
        onOpenBossJsonImport={() => setBossImportOpen(true)}
        showIotaExpertInboxActions={showIotaExpertInboxActions}
      />
      {mailboxesPanelOpen && myAddress.trim() && /^0x[a-fA-F0-9]{64}$/i.test(myAddress.trim()) ? (
        <div className="border-b border-violet-500/25 bg-violet-500/[0.06] px-4 py-3 dark:bg-violet-950/15">
          <p className="mb-2 text-sm font-semibold text-foreground">Meine Mailboxen</p>
          <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
            <strong className="text-foreground">Aktiv setzen</strong>, dann unten im Posteingang{' '}
            <strong className="text-foreground">Aktualisieren</strong> — lädt Shared + alle privaten Mailboxen.
            Verschlüsselt braucht Handshake zum Partner (Schloss oben).
          </p>
          <ChatViewMyMailboxesPanel
            myAddressLine={myAddress.trim()}
            serverMailboxIdHint={apiStatus?.mailboxId}
            contactDirectory={contactDirectory}
            onContactsChanged={onContactsChanged}
            onApplySendRecipient={onApplySendRecipient}
            onStatus={onMailboxPanelStatus}
            onMailboxActivated={toolbarProps.onRefresh}
            teamMailboxCreateAllowed={canCreateTeamMailbox(apiStatus)}
          />
        </div>
      ) : null}
      {showEinsatzleitungActions ? (
        <ChatViewEinsatzProfilImportDialog
          open={bossImportOpen}
          onOpenChange={setBossImportOpen}
          onContactsApplied={onContactsChanged}
        />
      ) : null}
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
        {onAcceptPendingHandshake ? (
          <ChatViewInboxHandshakeRequests
            offers={pendingHandshakeOffers}
            loading={pendingHandshakesLoading}
            sending={sending}
            directory={contactDirectory}
            onAccept={onAcceptPendingHandshake}
            onUseAsPartner={onUseSenderAsPartnerFromInbox ?? (() => {})}
            onDelete={onDeleteIncomingHandshake}
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
        <ChatViewInboxList
          loadError={loadError}
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
        />
      </div>
    </div>
  )
}
