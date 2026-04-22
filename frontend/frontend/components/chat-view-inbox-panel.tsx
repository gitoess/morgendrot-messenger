'use client'

/**
 * Posteingang als zusammenhängende Einheit: Kopfleiste + scrollbare Liste (Fehler/Leer/Zeilen).
 * Ergänzt `ChatViewInboxList` (Zeileninhalt) und `ChatViewInboxToolbar` (Aktionen) – die View orchestriert nur noch Daten.
 */

import type { ComponentProps } from 'react'
import { ChatViewInboxList } from '@/frontend/components/chat-view-inbox-list'
import {
  ChatViewInboxPartnerStrip,
  type InboxPartnerOption,
} from '@/frontend/components/chat-view-inbox-partner-strip'
import { ChatViewInboxToolbar } from '@/frontend/components/chat-view-inbox-toolbar'
import type { InboxDirectionFilter } from '@/frontend/features/inbox/inbox-partner-filter'
import type { InboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import type { InboxFeedReadPort } from '@/frontend/features/messenger-ports'

type InboxListRest = Omit<ComponentProps<typeof ChatViewInboxList>, keyof InboxFeedReadPort>
type InboxToolbarRest = Omit<
  ComponentProps<typeof ChatViewInboxToolbar>,
  'selectedInboxCount' | keyof InboxFeedReadPort
>

/** `selectedInboxCount` wird aus `selectedInboxIds` im Panel abgeleitet. */
export type ChatViewInboxPanelProps = InboxFeedReadPort &
  InboxListRest &
  InboxToolbarRest & {
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
  }

export function ChatViewInboxPanel(props: ChatViewInboxPanelProps) {
  const {
    loadError,
    basisUnreachable,
    messages,
    inboxRows,
    myAddress,
    contactDirectory,
    isMeshVerifiedForAddress,
    exportEcdhMorgPkgForMessage,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onForwardMessage,
    onHideAllVisibleLocal,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    toggleInboxSelection,
    onBulkHideSelected,
    onBulkPurgeSelected,
    toggleProtokollMark,
    protokollMarkedIds,
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
    loadingMore,
    loadMoreInbox,
    inboxHasMore,
    onAddSenderToContactBook,
    onSarqNakWire,
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
        onBulkHideSelected={onBulkHideSelected}
        onBulkPurgeSelected={() => void onBulkPurgeSelected()}
        onHideAllVisibleLocal={onHideAllVisibleLocal}
      />
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
        wireFilter={inboxWireFilter}
        onWireFilterChange={setInboxWireFilter}
        onPartnerSelectForSend={selectInboxPartnerForSend}
        onRemoveInboxPartnerFromQuickList={(address, opts) => {
          removeInboxPartnerFromQuickList(address, {
            hideMatchingMessages: opts.hideMatchingMessages,
            messageTransport: opts.messageTransport,
          })
        }}
      />
      <div className="max-h-[min(70vh,42rem)] overflow-y-auto">
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
          inboxSelectMode={inboxSelectMode}
          selectedInboxIds={selectedInboxIds}
          toggleInboxSelection={toggleInboxSelection}
          onDismissMeshInboundBanner={onDismissMeshInboundBanner}
          loadingMore={loadingMore}
          loadMoreInbox={loadMoreInbox}
          inboxHasMore={inboxHasMore}
          onAddSenderToContactBook={onAddSenderToContactBook}
          onSarqNakWire={onSarqNakWire}
        />
      </div>
    </div>
  )
}
