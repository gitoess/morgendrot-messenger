'use client'

import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { ChatViewInboxPanelProps } from '@/frontend/components/chat-view-inbox-panel'
import type { ChatViewPanelMessengerPorts } from '@/frontend/features/messenger-ports'
import { resolveActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'
import {
  MESSENGER_INBOX_FORCE_REFRESH_EVENT,
} from '@/frontend/lib/messenger-inbox-force-refresh'
import { inboxToolbarToolsForSendPath } from '@/frontend/lib/send-path-inbox-source-filter'

export type ChatViewInboxPanelPropsDeps = {
  messengerPorts: Pick<
    ChatViewPanelMessengerPorts,
    | 'inboxFeedRead'
    | 'inboxPanelRead'
    | 'contactDirectoryRead'
    | 'connectionStatusRead'
    | 'inboxViewUi'
    | 'handshakeOffersRead'
    | 'composerDraft'
    | 'composerSendPath'
    | 'sendActions'
    | 'sendTransportChoice'
    | 'attachmentBar'
    | 'inboxActions'
    | 'inboxExportActions'
    | 'inboxHandshakePanelActions'
    | 'inboxPanelLocalActions'
  >
  showPinnwandPinActions: boolean
  onOpenPhonebook: () => void
  showInboxIotaFilter: boolean
  showIotaExpertInboxActions: boolean
  pinnwandOverviewConfigured: boolean
  showInboxPackageExpertMenu: boolean
  inboxSearchQuery?: string
  conversationMenu?: ChatViewInboxPanelProps['conversationMenu']
  onOpenNotes?: () => void
  notesActive?: boolean
}

export function useChatViewInboxPanelProps(deps: ChatViewInboxPanelPropsDeps & {
  hidePartnerStrip?: boolean
  hideOverviewChips?: boolean
}): ChatViewInboxPanelProps {
  const {
    inboxFeedRead,
    inboxPanelRead,
    contactDirectoryRead,
    connectionStatusRead,
    inboxViewUi,
    handshakeOffersRead,
    composerDraft,
    composerSendPath,
    sendActions,
    sendTransportChoice,
    attachmentBar,
    inboxActions,
    inboxExportActions,
    inboxHandshakePanelActions,
    inboxPanelLocalActions,
  } = deps.messengerPorts

  const pathTools = useMemo(
    () =>
      inboxToolbarToolsForSendPath({
        activeSendPath: resolveActiveSendPath(
          composerSendPath.composerDelivery,
          sendTransportChoice.forcedTransport
        ),
        iotaPathFocus: composerSendPath.iotaPathFocus,
      }),
    [
      composerSendPath.composerDelivery,
      composerSendPath.iotaPathFocus,
      sendTransportChoice.forcedTransport,
    ]
  )

  const onRefresh = useCallback(() => {
    toast.message('Aktualisieren…', { description: 'Status, Posteingang und Kontakte werden neu geladen.' })
    void Promise.resolve(inboxActions.loadMessages('reset', undefined, { forceLive: true })).then(
      () => {
        toast.success('Posteingang aktualisiert')
      },
      () => {
        toast.error('Aktualisieren fehlgeschlagen')
      }
    )
    inboxActions.refreshContactDirectory()
    void handshakeOffersRead.reload()
  }, [inboxActions.loadMessages, inboxActions.refreshContactDirectory, handshakeOffersRead.reload])

  /** Boss-Header „Aktualisieren“ (suppressAppChrome) erreicht sonst nur Status-Poll. */
  useEffect(() => {
    const onForce = () => onRefresh()
    window.addEventListener(MESSENGER_INBOX_FORCE_REFRESH_EVENT, onForce)
    return () => window.removeEventListener(MESSENGER_INBOX_FORCE_REFRESH_EVENT, onForce)
  }, [onRefresh])

  const onMailboxPanelStatus = useCallback((msg: string, kind: 'success' | 'error') => {
    if (kind === 'success') toast.success(msg)
    else toast.error(msg)
  }, [])

  const onApplySendRecipient = useCallback(
    (addr: string) => {
      composerDraft.onRecipientChange(addr)
      inboxViewUi.selectInboxPartnerForSend(addr)
    },
    [composerDraft.onRecipientChange, inboxViewUi.selectInboxPartnerForSend]
  )

  /** Vertrag/Package-ID nur noch Einstellungen → Expertenmodus (kein Posteingang-Button). */
  const inboxPackageExpertMenu: ReactNode = null

  const inboxPanelProps = {
    ...inboxFeedRead,
    messageCount: inboxPanelRead.inboxTotalCount,
    inboxRowCount: inboxPanelRead.inboxRows.length,
    morgPkgFileRef: inboxActions.morgPkgFileRef,
    morgPkgDeviceFilesRef: inboxActions.morgPkgDeviceFilesRef,
    onMorgPkgImportFile: inboxActions.onMorgPkgImportFile,
    onMorgPkgDeviceFiles: inboxActions.onMorgPkgDeviceFiles,
    onMorgPkgDeviceExportPick: inboxActions.onMorgPkgDeviceExportPick,
    morgPkgDeviceBusy: inboxActions.morgPkgDeviceBusy,
    morgPkgExportRecipient: inboxActions.morgPkgExportRecipient,
    onMorgPkgExportRecipientChange: inboxActions.onMorgPkgExportRecipientChange,
    morgPkgExportPartnerOptions: inboxActions.morgPkgExportPartnerOptions,
    morgPkgImportCount: inboxActions.morgPkgImportCount,
    onOpenMorgPkgArchive: inboxActions.onOpenMorgPkgArchive,
    apiStatus: connectionStatusRead.apiStatus,
    onRefresh,
    pendingHandshakeOffers: [...handshakeOffersRead.pendingOffers],
    outgoingHandshakeOffers: [...handshakeOffersRead.outgoingOffers],
    pendingHandshakesLoading: inboxHandshakePanelActions.pendingHandshakesLoading,
    pendingHandshakeCount: inboxHandshakePanelActions.pendingHandshakeCount,
    sending: attachmentBar.sending,
    onAcceptPendingHandshake: inboxHandshakePanelActions.onAcceptPendingHandshake,
    onUseSenderAsPartnerFromInbox: inboxHandshakePanelActions.onUseSenderAsPartnerFromInbox,
    /* 1:1-Kontaktchat: Empfänger steht fest → kein Antworten-Button. Übersicht „Alle“ behält ihn. */
    onReplyToMessage:
      inboxViewUi.inboxPartnerFiltersArmed &&
      Boolean(inboxViewUi.inboxPartnerKey?.trim()) &&
      !inboxViewUi.inboxConversationGroupId
        ? undefined
        : inboxHandshakePanelActions.onReplyToMessage,
    onDeleteIncomingHandshake: inboxHandshakePanelActions.onDeleteIncomingHandshake,
    onDeleteOutgoingHandshake: inboxHandshakePanelActions.onDeleteOutgoingHandshake,
    onResendOutgoingHandshake: inboxHandshakePanelActions.onResendOutgoingHandshake,
    loading: inboxActions.loading,
    loadingMore: inboxActions.loadingMore,
    loadMoreInbox: inboxActions.loadMoreInbox,
    inboxHasMore: inboxActions.inboxHasMore,
    loadError: inboxActions.loadError,
    inboxFromCache: inboxActions.inboxFromCache,
    inboxCacheAgeMinutes: inboxActions.inboxCacheAgeMinutes,
    inboxLiveSource: inboxActions.inboxLiveSource,
    basisUnreachable: connectionStatusRead.basisUnreachable,
    inboxPartnerOptions: [...inboxViewUi.inboxPartnerOptions],
    inboxPartnerKey: inboxViewUi.inboxPartnerKey,
    setInboxPartnerKey: inboxViewUi.setInboxPartnerKey,
    inboxDirectionFilter: inboxViewUi.inboxDirectionFilter,
    setInboxDirectionFilter: inboxViewUi.setInboxDirectionFilter,
    inboxSourceFilter: inboxViewUi.inboxSourceFilter,
    setInboxSourceFilter: inboxViewUi.setInboxSourceFilter,
    inboxChannelFiltersArmed: inboxViewUi.inboxChannelFiltersArmed,
    setInboxChannelFiltersArmed: inboxViewUi.setInboxChannelFiltersArmed,
    inboxWireFiltersArmed: inboxViewUi.inboxWireFiltersArmed,
    setInboxWireFiltersArmed: inboxViewUi.setInboxWireFiltersArmed,
    inboxPartnerFiltersArmed: inboxViewUi.inboxPartnerFiltersArmed,
    setInboxPartnerFiltersArmed: inboxViewUi.setInboxPartnerFiltersArmed,
    inboxWireFilter: inboxViewUi.inboxWireFilter,
    setInboxWireFilter: inboxViewUi.setInboxWireFilter,
    inboxMediaFilter: inboxViewUi.inboxMediaFilter,
    setInboxMediaFilter: inboxViewUi.setInboxMediaFilter,
    selectInboxPartnerForSend: inboxViewUi.selectInboxPartnerForSend,
    removeInboxPartnerFromQuickList: inboxViewUi.removeInboxPartnerFromQuickList,
    inboxVisibilityHint: inboxViewUi.inboxVisibilityHint,
    inboxOverviewChipsVisible: inboxViewUi.inboxOverviewChipsVisible,
    inboxOverviewCategory: inboxViewUi.inboxOverviewCategory,
    inboxOverviewUnreadCounts: inboxViewUi.inboxOverviewUnreadCounts,
    isInboxMessageUnread: inboxViewUi.isInboxMessageUnread,
    isPinnwandInboxMessage: inboxViewUi.isPinnwandInboxMessage,
    inboxSelectMode: inboxViewUi.inboxSelectMode,
    setInboxSelectMode: inboxViewUi.setInboxSelectMode,
    selectedInboxIds: inboxViewUi.selectedInboxIds,
    hiddenInboxCount: inboxViewUi.hiddenInboxCount,
    toggleInboxSelection: inboxViewUi.toggleInboxSelection,
    protokollMarkedIds: inboxViewUi.protokollMarkedIds,
    pinnedPinnwandIds: inboxViewUi.pinnedPinnwandIds,
    onTogglePinnedPinnwand: inboxViewUi.togglePinnedPinnwand,
    toggleProtokollMark: inboxViewUi.toggleProtokollMark,
    inboxRows: [...inboxPanelRead.inboxRows],
    contactDirectory: contactDirectoryRead.directory,
    isMeshVerifiedForAddress: contactDirectoryRead.isMeshVerifiedForAddress,
    onExportEinsatzberichtJson: inboxExportActions.onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt: inboxExportActions.onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull: inboxExportActions.onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted: inboxExportActions.onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll: inboxExportActions.onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip: inboxExportActions.onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked: inboxExportActions.onExportEinsatzprotokollMarked,
    onExportMorgMediaZip: inboxExportActions.onExportMorgMediaZip,
    onExportMorgMediaDirect: inboxExportActions.onExportMorgMediaDirect,
    loadMessagesForMediaExport: inboxExportActions.loadMessagesForMediaExport,
    protokollMarkedCount: inboxViewUi.protokollMarkedIds.size,
    onHideInboxMessageLocal: inboxActions.onHideInboxMessageLocal,
    onPurgeInboxMessageChain: inboxActions.onPurgeInboxMessageChain,
    onForwardMessage: inboxActions.onForwardMessage,
    onToggleHideAllVisibleLocal: inboxActions.onHideAllVisibleLocal,
    onSelectAllVisible: inboxViewUi.selectAllVisibleInbox,
    onClearInboxSelection: inboxViewUi.clearInboxSelection,
    onBulkHideSelected: inboxActions.onBulkHideSelected,
    onBulkPurgeSelected: inboxActions.onBulkPurgeSelected,
    onBulkMarkProtokollSelected: inboxActions.onBulkMarkProtokollSelected,
    onBulkCopySelected: inboxActions.onBulkCopySelected,
    onBulkExportJsonSelected: inboxActions.onBulkExportJsonSelected,
    onBulkHashSelected: inboxActions.onBulkHashSelected,
    onBulkForwardSelected: inboxActions.onBulkForwardSelected,
    recipient: composerDraft.recipient,
    setStatus: sendActions.onStatusChange,
    setStatusMsg: sendActions.onStatusMsgChange,
    onAddSenderToContactBook: inboxPanelLocalActions.onAddSenderToContactBook,
    onSarqNakWire: inboxPanelLocalActions.onSarqNakWire,
    localPurgeBusy: inboxActions.localPurgeBusy,
    showPinnwandPinActions: deps.showPinnwandPinActions,
    showPhonebookButton: false,
    onContactsChanged: inboxActions.refreshContactDirectory,
    onMailboxPanelStatus,
    onApplySendRecipient,
    onOpenPhonebook: deps.onOpenPhonebook,
    onOpenPartnerSetup: inboxActions.openPartnerSetupPanel,
    messagingPersistenceMode: sendTransportChoice.messagingPersistenceMode,
    showInboxIotaFilter: deps.showInboxIotaFilter,
    showIotaExpertInboxActions: deps.showIotaExpertInboxActions,
    onInboxOverviewCategoryChange: inboxViewUi.setInboxOverviewCategory,
    pinnwandOverviewConfigured: deps.pinnwandOverviewConfigured,
    showInboxPackageExpertMenu: false,
    inboxPackageExpertMenu,
    hidePartnerStrip: deps.hidePartnerStrip ?? false,
    hideOverviewChips: deps.hideOverviewChips ?? false,
    pathTools,
    onOpenNotes: deps.onOpenNotes,
    notesActive: deps.notesActive,
  } satisfies ChatViewInboxPanelProps

  return inboxPanelProps
}
