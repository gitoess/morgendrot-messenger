'use client'

import { useCallback, useMemo, type ReactNode, type RefObject } from 'react'
import { toast } from 'sonner'
import { ChatViewInboxPackageExpertMenu } from '@/frontend/components/chat-view-inbox-package-expert-menu'
import type { ChatViewInboxPanelProps } from '@/frontend/components/chat-view-inbox-panel'
import type { InboxPartnerOption } from '@/frontend/components/chat-view-inbox-partner-strip'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'
import type { InboxDirectionFilter } from '@/frontend/features/inbox/inbox-partner-filter'
import type { HandshakeOfferSource } from '@/frontend/lib/handshake-offer-delete'
import type {
  OutgoingHandshakeOffer,
  PendingHandshakeOffer,
} from '@/frontend/lib/handshake-offers-types'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import type { InboxOverviewCategory } from '@/frontend/lib/inbox-overview-filter'
import type { InboxSourceFilter } from '@/frontend/lib/inbox-source-filter'
import type { InboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import type { Message } from '@/frontend/lib/types'

export type ChatViewInboxPanelPropsDeps = {
  messengerPorts: Pick<ChatViewMessengerPorts, 'inboxFeedRead'>
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
  apiStatus: ApiStatus | null
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
  basisUnreachable: boolean | undefined
  inboxVisibilityHint: string | null | undefined
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
  removeInboxPartnerFromQuickList: ChatViewInboxPanelProps['removeInboxPartnerFromQuickList']
  directory: Record<string, ContactMeshEntryClient>
  isMeshVerifiedForAddress: ChatViewInboxPanelProps['isMeshVerifiedForAddress']
  exportEcdhMorgPkgForMessage: ChatViewInboxPanelProps['exportEcdhMorgPkgForMessage']
  onExportEinsatzberichtJson: ChatViewInboxPanelProps['onExportEinsatzberichtJson']
  onExportEinsatzberichtTxt: ChatViewInboxPanelProps['onExportEinsatzberichtTxt']
  onExportEinsatzberichtTxtFull: ChatViewInboxPanelProps['onExportEinsatzberichtTxtFull']
  onExportEinsatzberichtEncrypted: ChatViewInboxPanelProps['onExportEinsatzberichtEncrypted']
  onExportEinsatzprotokoll: ChatViewInboxPanelProps['onExportEinsatzprotokoll']
  onExportEinsatzprotokollPlainZip: ChatViewInboxPanelProps['onExportEinsatzprotokollPlainZip']
  onExportEinsatzprotokollMarked: ChatViewInboxPanelProps['onExportEinsatzprotokollMarked']
  protokollMarkedIds: Set<string>
  onHideInboxMessageLocal: ChatViewInboxPanelProps['onHideInboxMessageLocal']
  onPurgeInboxMessageChain: ChatViewInboxPanelProps['onPurgeInboxMessageChain']
  onForwardMessage: ChatViewInboxPanelProps['onForwardMessage']
  onHideAllVisibleLocal: () => void
  inboxSelectMode: boolean
  setInboxSelectMode: (v: boolean | ((p: boolean) => boolean)) => void
  selectedInboxIds: Set<string>
  hiddenInboxCount: number
  toggleInboxSelection: (id: string) => void
  selectAllVisibleInbox: () => void
  clearInboxSelection: () => void
  onBulkHideSelected: () => void
  onBulkPurgeSelected: () => void
  toggleProtokollMark: (id: string) => void
  recipient: string
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  addInboxSenderToContactBook: (address: string) => void
  onSarqNakWire: (wire: string) => void | Promise<void>
  localPurgeBusy: boolean
  pinnedPinnwandIds: Set<string>
  togglePinnedPinnwand: (id: string) => void
  showPinnwandPinActions: boolean
  openPartnerSetupPanel: () => void
  onOpenPhonebook: () => void
  messagingPersistenceMode: MessagingPersistenceMode
  showInboxIotaFilter: boolean
  showIotaExpertInboxActions: boolean
  inboxOverviewChipsVisible: boolean
  inboxOverviewCategory: InboxOverviewCategory
  setInboxOverviewCategory: (c: InboxOverviewCategory) => void
  inboxOverviewUnreadCounts: Record<InboxOverviewCategory, number>
  pinnwandOverviewConfigured: boolean
  isInboxMessageUnread: (msg: Message) => boolean
  isPinnwandInboxMessage: (msg: Message) => boolean
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
      deps.selectInboxPartnerForSend(addr)
    },
    [deps.setRecipient, deps.selectInboxPartnerForSend]
  )

  const inboxPackageExpertMenu: ReactNode = useMemo(
    () =>
      deps.showInboxPackageExpertMenu ? (
        <ChatViewInboxPackageExpertMenu
          serverPackageId={deps.apiStatus?.packageId}
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
      deps.apiStatus?.packageId,
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
    ...deps.messengerPorts.inboxFeedRead,
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
    apiStatus: deps.apiStatus,
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
    basisUnreachable: deps.basisUnreachable,
    inboxVisibilityHint: deps.inboxVisibilityHint,
    inboxPartnerOptions: deps.inboxPartnerOptions,
    inboxPartnerKey: deps.inboxPartnerKey,
    setInboxPartnerKey: deps.setInboxPartnerKey,
    inboxDirectionFilter: deps.inboxDirectionFilter,
    setInboxDirectionFilter: deps.setInboxDirectionFilter,
    inboxSourceFilter: deps.inboxSourceFilter,
    setInboxSourceFilter: deps.setInboxSourceFilter,
    inboxChannelFiltersArmed: deps.inboxChannelFiltersArmed,
    setInboxChannelFiltersArmed: deps.setInboxChannelFiltersArmed,
    inboxWireFiltersArmed: deps.inboxWireFiltersArmed,
    setInboxWireFiltersArmed: deps.setInboxWireFiltersArmed,
    inboxPartnerFiltersArmed: deps.inboxPartnerFiltersArmed,
    setInboxPartnerFiltersArmed: deps.setInboxPartnerFiltersArmed,
    inboxWireFilter: deps.inboxWireFilter,
    setInboxWireFilter: deps.setInboxWireFilter,
    selectInboxPartnerForSend: deps.selectInboxPartnerForSend,
    removeInboxPartnerFromQuickList: deps.removeInboxPartnerFromQuickList,
    inboxRows: deps.inboxRows,
    contactDirectory: deps.directory,
    isMeshVerifiedForAddress: deps.isMeshVerifiedForAddress,
    exportEcdhMorgPkgForMessage: deps.exportEcdhMorgPkgForMessage,
    onExportEinsatzberichtJson: deps.onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt: deps.onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull: deps.onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted: deps.onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll: deps.onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip: deps.onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked: deps.onExportEinsatzprotokollMarked,
    protokollMarkedCount: deps.protokollMarkedIds.size,
    protokollMarkedIds: deps.protokollMarkedIds,
    onHideInboxMessageLocal: deps.onHideInboxMessageLocal,
    onPurgeInboxMessageChain: deps.onPurgeInboxMessageChain,
    onForwardMessage: deps.onForwardMessage,
    onToggleHideAllVisibleLocal: deps.onHideAllVisibleLocal,
    inboxSelectMode: deps.inboxSelectMode,
    setInboxSelectMode: deps.setInboxSelectMode,
    selectedInboxIds: deps.selectedInboxIds,
    hiddenInboxCount: deps.hiddenInboxCount,
    toggleInboxSelection: deps.toggleInboxSelection,
    onSelectAllVisible: deps.selectAllVisibleInbox,
    onClearInboxSelection: deps.clearInboxSelection,
    onBulkHideSelected: deps.onBulkHideSelected,
    onBulkPurgeSelected: deps.onBulkPurgeSelected,
    toggleProtokollMark: deps.toggleProtokollMark,
    recipient: deps.recipient,
    setStatus: deps.setStatus,
    setStatusMsg: deps.setStatusMsg,
    onAddSenderToContactBook: deps.addInboxSenderToContactBook,
    onSarqNakWire: deps.onSarqNakWire,
    localPurgeBusy: deps.localPurgeBusy,
    pinnedPinnwandIds: deps.pinnedPinnwandIds,
    onTogglePinnedPinnwand: deps.togglePinnedPinnwand,
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
    inboxOverviewChipsVisible: deps.inboxOverviewChipsVisible,
    inboxOverviewCategory: deps.inboxOverviewCategory,
    onInboxOverviewCategoryChange: deps.setInboxOverviewCategory,
    inboxOverviewUnreadCounts: deps.inboxOverviewUnreadCounts,
    pinnwandOverviewConfigured: deps.pinnwandOverviewConfigured,
    isInboxMessageUnread: deps.isInboxMessageUnread,
    isPinnwandInboxMessage: deps.isPinnwandInboxMessage,
    showInboxPackageExpertMenu: deps.showInboxPackageExpertMenu,
    inboxPackageExpertMenu,
  } satisfies ChatViewInboxPanelProps

  return inboxPanelProps
}
