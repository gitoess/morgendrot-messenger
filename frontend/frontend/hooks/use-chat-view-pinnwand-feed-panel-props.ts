'use client'

import { useMemo } from 'react'
import type { ChatViewPinnwandFeedPanelProps } from '@/frontend/components/chat-view-pinnwand-feed-panel'
import type { ChatViewPanelMessengerPorts } from '@/frontend/features/messenger-ports'

export type ChatViewPinnwandFeedPanelPropsDeps = {
  messengerPorts: Pick<
    ChatViewPanelMessengerPorts,
    | 'connectionStatusRead'
    | 'contactDirectoryRead'
    | 'inboxFeedRead'
    | 'inboxViewUi'
    | 'inboxActions'
    | 'inboxExportActions'
    | 'pinnwandFeedRead'
    | 'attachmentBar'
    | 'inboxHandshakePanelActions'
    | 'inboxPanelLocalActions'
  >
  role: string
  canPost: boolean
  unreadCount: number
}

export function useChatViewPinnwandFeedPanelProps(
  deps: ChatViewPinnwandFeedPanelPropsDeps
): ChatViewPinnwandFeedPanelProps {
  const {
    connectionStatusRead,
    contactDirectoryRead,
    inboxFeedRead,
    inboxViewUi,
    inboxActions,
    inboxExportActions,
    pinnwandFeedRead,
    attachmentBar,
    inboxHandshakePanelActions,
    inboxPanelLocalActions,
  } = deps.messengerPorts

  return useMemo(
    () => ({
      apiStatus: connectionStatusRead.apiStatus,
      role: deps.role,
      canPost: deps.canPost,
      unreadCount: deps.unreadCount,
      loading: inboxActions.loading,
      onRefresh: () => void inboxActions.loadMessages('reset'),
      loadError: inboxActions.loadError,
      inboxFromCache: inboxActions.inboxFromCache,
      inboxCacheAgeMinutes: inboxActions.inboxCacheAgeMinutes,
      basisUnreachable: connectionStatusRead.basisUnreachable ?? false,
      messages: [...pinnwandFeedRead.feedMessages],
      inboxRows: [...pinnwandFeedRead.feedInboxRows],
      myAddress: inboxFeedRead.myAddress,
      contactDirectory: contactDirectoryRead.directory,
      isMeshVerifiedForAddress: contactDirectoryRead.isMeshVerifiedForAddress,
      exportEcdhMorgPkgForMessage: inboxExportActions.exportEcdhMorgPkgForMessage,
      onHideInboxMessageLocal: inboxActions.onHideInboxMessageLocal,
      onPurgeInboxMessageChain: inboxActions.onPurgeInboxMessageChain,
      onForwardMessage: inboxActions.onForwardMessage,
      onReplyToMessage: inboxHandshakePanelActions.onReplyToMessage,
      toggleProtokollMark: inboxViewUi.toggleProtokollMark,
      protokollMarkedIds: inboxViewUi.protokollMarkedIds,
      pinnedPinnwandIds: inboxViewUi.pinnedPinnwandIds,
      onTogglePinnedPinnwand: inboxViewUi.togglePinnedPinnwand,
      showPinnwandPinActions: deps.canPost,
      inboxSelectMode: inboxViewUi.inboxSelectMode,
      selectedInboxIds: inboxViewUi.selectedInboxIds,
      toggleInboxSelection: inboxViewUi.toggleInboxSelection,
      loadingMore: inboxActions.loadingMore,
      loadMoreInbox: inboxActions.loadMoreInbox,
      inboxHasMore: inboxActions.inboxHasMore,
      onAddSenderToContactBook: inboxPanelLocalActions.onAddSenderToContactBook,
      onSarqNakWire: inboxPanelLocalActions.onSarqNakWire,
      isInboxMessageUnread: inboxViewUi.isInboxMessageUnread,
      isPinnwandInboxMessage: inboxViewUi.isPinnwandInboxMessage,
      sending: attachmentBar.sending,
    }),
    [
      connectionStatusRead.apiStatus,
      connectionStatusRead.basisUnreachable,
      contactDirectoryRead.directory,
      contactDirectoryRead.isMeshVerifiedForAddress,
      inboxFeedRead.myAddress,
      inboxViewUi,
      inboxActions,
      inboxExportActions,
      pinnwandFeedRead.feedMessages,
      pinnwandFeedRead.feedInboxRows,
      attachmentBar.sending,
      inboxHandshakePanelActions.onReplyToMessage,
      inboxPanelLocalActions.onAddSenderToContactBook,
      inboxPanelLocalActions.onSarqNakWire,
      deps.role,
      deps.canPost,
      deps.unreadCount,
    ]
  )
}
