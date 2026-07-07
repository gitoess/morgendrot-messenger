'use client'

import { useCallback, useMemo, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ChatViewInboxPackageExpertMenu } from '@/frontend/components/chat-view-inbox-package-expert-menu'
import type { ChatViewInboxPanelProps } from '@/frontend/components/chat-view-inbox-panel'
import type { ChatViewPanelMessengerPorts } from '@/frontend/features/messenger-ports'

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
    | 'sendActions'
    | 'sendTransportChoice'
    | 'attachmentBar'
    | 'inboxActions'
    | 'inboxExportActions'
    | 'packageExpert'
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
  onOpenSettings?: () => void
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
    sendActions,
    sendTransportChoice,
    attachmentBar,
    inboxActions,
    inboxExportActions,
    packageExpert,
    inboxHandshakePanelActions,
    inboxPanelLocalActions,
  } = deps.messengerPorts

  const onRefresh = useCallback(() => {
    void inboxActions.loadMessages('reset', undefined, { forceLive: true })
    inboxActions.refreshContactDirectory()
    void handshakeOffersRead.reload()
  }, [inboxActions.loadMessages, inboxActions.refreshContactDirectory, handshakeOffersRead.reload])

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

  const inboxPackageExpertMenu: ReactNode = useMemo(
    () =>
      deps.showInboxPackageExpertMenu ? (
        <ChatViewInboxPackageExpertMenu
          serverPackageId={connectionStatusRead.apiStatus?.packageId}
          inboxPackageFilter={packageExpert.inboxPackageFilter}
          packageIdSuggestions={packageExpert.packageIdSuggestions}
          packageIdBusy={packageExpert.packageIdBusy}
          onApplyTemporary={packageExpert.applyTemporaryInboxPackage}
          onClearTemporary={packageExpert.clearTemporaryInboxPackage}
          onApplyPermanent={packageExpert.applyPackageIdBackend}
          onOpenSettings={deps.onOpenSettings}
        />
      ) : null,
    [
      deps.showInboxPackageExpertMenu,
      connectionStatusRead.apiStatus?.packageId,
      packageExpert.inboxPackageFilter,
      packageExpert.packageIdSuggestions,
      packageExpert.packageIdBusy,
      packageExpert.applyTemporaryInboxPackage,
      packageExpert.clearTemporaryInboxPackage,
      packageExpert.applyPackageIdBackend,
      deps.onOpenSettings,
    ]
  )

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
    onReplyToMessage: inboxHandshakePanelActions.onReplyToMessage,
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
    exportEcdhMorgPkgForMessage: inboxExportActions.exportEcdhMorgPkgForMessage,
    onExportEinsatzberichtJson: inboxExportActions.onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt: inboxExportActions.onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull: inboxExportActions.onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted: inboxExportActions.onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll: inboxExportActions.onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip: inboxExportActions.onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked: inboxExportActions.onExportEinsatzprotokollMarked,
    protokollMarkedCount: inboxViewUi.protokollMarkedIds.size,
    onHideInboxMessageLocal: inboxActions.onHideInboxMessageLocal,
    onPurgeInboxMessageChain: inboxActions.onPurgeInboxMessageChain,
    onForwardMessage: inboxActions.onForwardMessage,
    onToggleHideAllVisibleLocal: inboxActions.onHideAllVisibleLocal,
    onSelectAllVisible: inboxViewUi.selectAllVisibleInbox,
    onClearInboxSelection: inboxViewUi.clearInboxSelection,
    onBulkHideSelected: inboxActions.onBulkHideSelected,
    onBulkPurgeSelected: inboxActions.onBulkPurgeSelected,
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
    showInboxPackageExpertMenu: deps.showInboxPackageExpertMenu,
    inboxPackageExpertMenu,
    hidePartnerStrip: deps.hidePartnerStrip ?? false,
    hideOverviewChips: deps.hideOverviewChips ?? false,
  } satisfies ChatViewInboxPanelProps

  return inboxPanelProps
}
