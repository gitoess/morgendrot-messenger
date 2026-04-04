'use client'

/**
 * Posteingang als zusammenhängende Einheit: Kopfleiste + scrollbare Liste (Fehler/Leer/Zeilen).
 * Ergänzt `ChatViewInboxList` (Zeileninhalt) und `ChatViewInboxToolbar` (Aktionen) – die View orchestriert nur noch Daten.
 */

import type { ComponentProps } from 'react'
import { ChatViewInboxList } from '@/frontend/components/chat-view-inbox-list'
import { ChatViewInboxToolbar } from '@/frontend/components/chat-view-inbox-toolbar'

/** `selectedInboxCount` wird aus `selectedInboxIds` im Panel abgeleitet. */
export type ChatViewInboxPanelProps = Omit<ComponentProps<typeof ChatViewInboxToolbar>, 'selectedInboxCount'> &
  ComponentProps<typeof ChatViewInboxList>

export function ChatViewInboxPanel(props: ChatViewInboxPanelProps) {
  const {
    loadError,
    messages,
    inboxRows,
    myAddress,
    contactDirectory,
    isMeshVerifiedForAddress,
    exportEcdhMorgPkgForMessage,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onHideAllVisibleLocal,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    toggleInboxSelection,
    onBulkHideSelected,
    onBulkPurgeSelected,
    toggleProtokollMark,
    protokollMarkedIds,
    onDismissMeshInboundBanner,
    loadingMore,
    loadMoreInbox,
    inboxHasMore,
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
      <div className="max-h-[min(70vh,42rem)] overflow-y-auto">
        <ChatViewInboxList
          loadError={loadError}
          messages={messages}
          inboxRows={inboxRows}
          myAddress={myAddress}
          contactDirectory={contactDirectory}
          isMeshVerifiedForAddress={isMeshVerifiedForAddress}
          exportEcdhMorgPkgForMessage={exportEcdhMorgPkgForMessage}
          onHideInboxMessageLocal={onHideInboxMessageLocal}
          onPurgeInboxMessageChain={onPurgeInboxMessageChain}
          toggleProtokollMark={toggleProtokollMark}
          protokollMarkedIds={protokollMarkedIds}
          inboxSelectMode={inboxSelectMode}
          selectedInboxIds={selectedInboxIds}
          toggleInboxSelection={toggleInboxSelection}
          onDismissMeshInboundBanner={onDismissMeshInboundBanner}
          loadingMore={loadingMore}
          loadMoreInbox={loadMoreInbox}
          inboxHasMore={inboxHasMore}
        />
      </div>
    </div>
  )
}
