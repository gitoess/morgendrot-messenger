'use client'

import { useCallback, useMemo, type ReactNode, type RefObject } from 'react'
import { toast } from 'sonner'
import { ChatViewInboxPackageExpertMenu } from '@/frontend/components/chat-view-inbox-package-expert-menu'
import type { ChatViewInboxPanelProps } from '@/frontend/components/chat-view-inbox-panel'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'
import type { HandshakeOfferSource } from '@/frontend/lib/handshake-offer-delete'
import type {
  OutgoingHandshakeOffer,
  PendingHandshakeOffer,
} from '@/frontend/lib/handshake-offers-types'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import type { Message } from '@/frontend/lib/types'

export type ChatViewInboxPanelPropsDeps = {
  messengerPorts: Pick<
    ChatViewMessengerPorts,
    'inboxFeedRead' | 'contactDirectoryRead' | 'connectionStatusRead' | 'inboxViewUi'
  >
  inboxTotalCount: number
  inboxRows: ChatViewInboxPanelProps['inboxRows']
  morgPkgFileRef: RefObject<HTMLInputElement | null>
  morgPkgDeviceFilesRef: RefObject<HTMLInputElement | null>
  onMorgPkgImportFile: ChatViewInboxPanelProps['onMorgPkgImportFile']
  onMorgPkgDeviceFiles: ChatViewInboxPanelProps['onMorgPkgDeviceFiles']
  onMorgPkgDeviceExportPick: ChatViewInboxPanelProps['onMorgPkgDeviceExportPick']
  morgPkgDeviceBusy: boolean
  morgPkgExportRecipient: string
  setMorgPkgExportRecipient: (v: string) => void
  morgPkgExportPartnerOptions: ChatViewInboxPanelProps['morgPkgExportPartnerOptions']
  morgPkgImportCount: number
  onOpenMorgPkgArchive: () => void
  loadMessages: (
    mode?: 'reset' | 'append' | 'poll',
    overridePackageId?: unknown,
    opts?: { silent?: boolean }
  ) => void | Promise<void>
  refreshContactDirectory: () => void
  reloadPendingHandshakes: () => void
  pendingHandshakeOffers: PendingHandshakeOffer[]
  outgoingHandshakeOffers: OutgoingHandshakeOffer[]
  pendingHandshakesLoading: boolean
  pendingHandshakeCount: number
  sending: boolean
  onAcceptPendingHandshake: (sender: string) => void | Promise<void>
  onUseSenderAsPartnerFromInbox: (sender: string) => void
  onReplyToMessage: (msg: Message) => void
  onDeleteIncomingHandshake: (
    sender: string,
    nonce: string,
    source: HandshakeOfferSource
  ) => void | Promise<void>
  onDeleteOutgoingHandshake: (
    recipient: string,
    nonce: string,
    source: HandshakeOfferSource
  ) => void | Promise<void>
  onResendOutgoingHandshake: (recipient: string) => void | Promise<void>
  loading: boolean
  loadingMore: boolean
  loadMoreInbox: () => void
  inboxHasMore: boolean
  loadError: string | null
  inboxFromCache: boolean
  inboxCacheAgeMinutes: number | null
  inboxLiveSource: ChatViewInboxPanelProps['inboxLiveSource']
  exportEcdhMorgPkgForMessage: ChatViewInboxPanelProps['exportEcdhMorgPkgForMessage']
  onExportEinsatzberichtJson: ChatViewInboxPanelProps['onExportEinsatzberichtJson']
  onExportEinsatzberichtTxt: ChatViewInboxPanelProps['onExportEinsatzberichtTxt']
  onExportEinsatzberichtTxtFull: ChatViewInboxPanelProps['onExportEinsatzberichtTxtFull']
  onExportEinsatzberichtEncrypted: ChatViewInboxPanelProps['onExportEinsatzberichtEncrypted']
  onExportEinsatzprotokoll: ChatViewInboxPanelProps['onExportEinsatzprotokoll']
  onExportEinsatzprotokollPlainZip: ChatViewInboxPanelProps['onExportEinsatzprotokollPlainZip']
  onExportEinsatzprotokollMarked: ChatViewInboxPanelProps['onExportEinsatzprotokollMarked']
  onHideInboxMessageLocal: ChatViewInboxPanelProps['onHideInboxMessageLocal']
  onPurgeInboxMessageChain: ChatViewInboxPanelProps['onPurgeInboxMessageChain']
  onForwardMessage: ChatViewInboxPanelProps['onForwardMessage']
  onHideAllVisibleLocal: () => void
  onBulkHideSelected: () => void
  onBulkPurgeSelected: () => void
  recipient: string
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  addInboxSenderToContactBook: (address: string) => void
  onSarqNakWire: (wire: string) => void | Promise<void>
  localPurgeBusy: boolean
  showPinnwandPinActions: boolean
  openPartnerSetupPanel: () => void
  onOpenPhonebook: () => void
  messagingPersistenceMode: MessagingPersistenceMode
  showInboxIotaFilter: boolean
  showIotaExpertInboxActions: boolean
  pinnwandOverviewConfigured: boolean
  showInboxPackageExpertMenu: boolean
  inboxPackageFilter: string
  packageIdSuggestions: string[]
  packageIdBusy: boolean
  applyTemporaryInboxPackage: (packageId: string) => void | Promise<void>
  clearTemporaryInboxPackage: () => void | Promise<void>
  applyPackageIdBackend: (packageId: string) => void | Promise<void>
  onOpenSettings?: () => void
  setRecipient: (v: string) => void
}

export function useChatViewInboxPanelProps(deps: ChatViewInboxPanelPropsDeps): ChatViewInboxPanelProps {
  const { inboxFeedRead, contactDirectoryRead, connectionStatusRead, inboxViewUi } = deps.messengerPorts

  const onRefresh = useCallback(() => {
    void deps.loadMessages('reset')
    deps.refreshContactDirectory()
    void deps.reloadPendingHandshakes()
  }, [deps.loadMessages, deps.refreshContactDirectory, deps.reloadPendingHandshakes])

  const onMailboxPanelStatus = useCallback((msg: string, kind: 'success' | 'error') => {
    if (kind === 'success') toast.success(msg)
    else toast.error(msg)
  }, [])

  const onApplySendRecipient = useCallback(
    (addr: string) => {
      deps.setRecipient(addr)
      inboxViewUi.selectInboxPartnerForSend(addr)
    },
    [deps.setRecipient, inboxViewUi.selectInboxPartnerForSend]
  )

  const inboxPackageExpertMenu: ReactNode = useMemo(
    () =>
      deps.showInboxPackageExpertMenu ? (
        <ChatViewInboxPackageExpertMenu
          serverPackageId={connectionStatusRead.apiStatus?.packageId}
          inboxPackageFilter={deps.inboxPackageFilter}
          packageIdSuggestions={deps.packageIdSuggestions}
          packageIdBusy={deps.packageIdBusy}
          onApplyTemporary={deps.applyTemporaryInboxPackage}
          onClearTemporary={deps.clearTemporaryInboxPackage}
          onApplyPermanent={deps.applyPackageIdBackend}
          onOpenSettings={deps.onOpenSettings}
        />
      ) : null,
    [
      deps.showInboxPackageExpertMenu,
      connectionStatusRead.apiStatus?.packageId,
      deps.inboxPackageFilter,
      deps.packageIdSuggestions,
      deps.packageIdBusy,
      deps.applyTemporaryInboxPackage,
      deps.clearTemporaryInboxPackage,
      deps.applyPackageIdBackend,
      deps.onOpenSettings,
    ]
  )

  const inboxPanelProps = {
    ...inboxFeedRead,
    messageCount: deps.inboxTotalCount,
    inboxRowCount: deps.inboxRows.length,
    morgPkgFileRef: deps.morgPkgFileRef,
    morgPkgDeviceFilesRef: deps.morgPkgDeviceFilesRef,
    onMorgPkgImportFile: deps.onMorgPkgImportFile,
    onMorgPkgDeviceFiles: deps.onMorgPkgDeviceFiles,
    onMorgPkgDeviceExportPick: deps.onMorgPkgDeviceExportPick,
    morgPkgDeviceBusy: deps.morgPkgDeviceBusy,
    morgPkgExportRecipient: deps.morgPkgExportRecipient,
    onMorgPkgExportRecipientChange: deps.setMorgPkgExportRecipient,
    morgPkgExportPartnerOptions: deps.morgPkgExportPartnerOptions,
    morgPkgImportCount: deps.morgPkgImportCount,
    onOpenMorgPkgArchive: deps.onOpenMorgPkgArchive,
    apiStatus: connectionStatusRead.apiStatus,
    onRefresh,
    pendingHandshakeOffers: deps.pendingHandshakeOffers,
    outgoingHandshakeOffers: deps.outgoingHandshakeOffers,
    pendingHandshakesLoading: deps.pendingHandshakesLoading,
    pendingHandshakeCount: deps.pendingHandshakeCount,
    sending: deps.sending,
    onAcceptPendingHandshake: deps.onAcceptPendingHandshake,
    onUseSenderAsPartnerFromInbox: deps.onUseSenderAsPartnerFromInbox,
    onReplyToMessage: deps.onReplyToMessage,
    onDeleteIncomingHandshake: deps.onDeleteIncomingHandshake,
    onDeleteOutgoingHandshake: deps.onDeleteOutgoingHandshake,
    onResendOutgoingHandshake: deps.onResendOutgoingHandshake,
    loading: deps.loading,
    loadingMore: deps.loadingMore,
    loadMoreInbox: deps.loadMoreInbox,
    inboxHasMore: deps.inboxHasMore,
    loadError: deps.loadError,
    inboxFromCache: deps.inboxFromCache,
    inboxCacheAgeMinutes: deps.inboxCacheAgeMinutes,
    inboxLiveSource: deps.inboxLiveSource,
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
    inboxRows: deps.inboxRows,
    contactDirectory: contactDirectoryRead.directory,
    isMeshVerifiedForAddress: contactDirectoryRead.isMeshVerifiedForAddress,
    exportEcdhMorgPkgForMessage: deps.exportEcdhMorgPkgForMessage,
    onExportEinsatzberichtJson: deps.onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt: deps.onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull: deps.onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted: deps.onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll: deps.onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip: deps.onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked: deps.onExportEinsatzprotokollMarked,
    protokollMarkedCount: inboxViewUi.protokollMarkedIds.size,
    onHideInboxMessageLocal: deps.onHideInboxMessageLocal,
    onPurgeInboxMessageChain: deps.onPurgeInboxMessageChain,
    onForwardMessage: deps.onForwardMessage,
    onToggleHideAllVisibleLocal: deps.onHideAllVisibleLocal,
    onSelectAllVisible: inboxViewUi.selectAllVisibleInbox,
    onClearInboxSelection: inboxViewUi.clearInboxSelection,
    onBulkHideSelected: deps.onBulkHideSelected,
    onBulkPurgeSelected: deps.onBulkPurgeSelected,
    recipient: deps.recipient,
    setStatus: deps.setStatus,
    setStatusMsg: deps.setStatusMsg,
    onAddSenderToContactBook: deps.addInboxSenderToContactBook,
    onSarqNakWire: deps.onSarqNakWire,
    localPurgeBusy: deps.localPurgeBusy,
    showPinnwandPinActions: deps.showPinnwandPinActions,
    showPhonebookButton: false,
    onContactsChanged: deps.refreshContactDirectory,
    onMailboxPanelStatus,
    onApplySendRecipient,
    onOpenPhonebook: deps.onOpenPhonebook,
    onOpenPartnerSetup: deps.openPartnerSetupPanel,
    messagingPersistenceMode: deps.messagingPersistenceMode,
    showInboxIotaFilter: deps.showInboxIotaFilter,
    showIotaExpertInboxActions: deps.showIotaExpertInboxActions,
    onInboxOverviewCategoryChange: inboxViewUi.setInboxOverviewCategory,
    pinnwandOverviewConfigured: deps.pinnwandOverviewConfigured,
    showInboxPackageExpertMenu: deps.showInboxPackageExpertMenu,
    inboxPackageExpertMenu,
  } satisfies ChatViewInboxPanelProps

  return inboxPanelProps
}
