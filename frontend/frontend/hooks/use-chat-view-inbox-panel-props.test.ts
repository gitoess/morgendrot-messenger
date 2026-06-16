import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useChatViewInboxPanelProps } from '@/frontend/hooks/use-chat-view-inbox-panel-props'
import type { ChatViewInboxPanelPropsDeps } from '@/frontend/hooks/use-chat-view-inbox-panel-props'
import { testMessengerPorts } from '@/frontend/lib/test-fixtures/messenger-ports'

vi.mock('@/frontend/components/chat-view-inbox-package-expert-menu', () => ({
  ChatViewInboxPackageExpertMenu: () => null,
}))

function baseDeps(over: Partial<ChatViewInboxPanelPropsDeps> = {}): ChatViewInboxPanelPropsDeps {
  const myAddress = `0x${'a'.repeat(64)}`
  const fullPorts = testMessengerPorts({ myAddress })
  return {
    messengerPorts:
      over.messengerPorts ??
      ({
        inboxFeedRead: fullPorts.inboxFeedRead,
        contactDirectoryRead: fullPorts.contactDirectoryRead,
        connectionStatusRead: fullPorts.connectionStatusRead,
      } satisfies ChatViewInboxPanelPropsDeps['messengerPorts']),
    inboxTotalCount: 0,
    inboxRows: [],
    morgPkgFileRef: { current: null },
    morgPkgDeviceFilesRef: { current: null },
    onMorgPkgImportFile: vi.fn(),
    onMorgPkgDeviceFiles: vi.fn(),
    onMorgPkgDeviceExportPick: vi.fn(),
    morgPkgDeviceBusy: false,
    morgPkgExportRecipient: '',
    setMorgPkgExportRecipient: vi.fn(),
    morgPkgExportPartnerOptions: [],
    morgPkgImportCount: 0,
    onOpenMorgPkgArchive: vi.fn(),
    loadMessages: vi.fn(),
    refreshContactDirectory: vi.fn(),
    reloadPendingHandshakes: vi.fn(),
    pendingHandshakeOffers: [],
    outgoingHandshakeOffers: [],
    pendingHandshakesLoading: false,
    pendingHandshakeCount: 0,
    sending: false,
    onAcceptPendingHandshake: vi.fn(),
    onUseSenderAsPartnerFromInbox: vi.fn(),
    onReplyToMessage: vi.fn(),
    onDeleteIncomingHandshake: vi.fn(),
    onDeleteOutgoingHandshake: vi.fn(),
    onResendOutgoingHandshake: vi.fn(),
    loading: false,
    loadingMore: false,
    loadMoreInbox: vi.fn(),
    inboxHasMore: false,
    loadError: null,
    inboxFromCache: false,
    inboxCacheAgeMinutes: null,
    inboxLiveSource: 'api',
    inboxVisibilityHint: null,
    inboxPartnerOptions: [],
    inboxPartnerKey: null,
    setInboxPartnerKey: vi.fn(),
    inboxDirectionFilter: 'all',
    setInboxDirectionFilter: vi.fn(),
    inboxSourceFilter: 'all',
    setInboxSourceFilter: vi.fn(),
    inboxChannelFiltersArmed: false,
    setInboxChannelFiltersArmed: vi.fn(),
    inboxWireFiltersArmed: false,
    setInboxWireFiltersArmed: vi.fn(),
    inboxPartnerFiltersArmed: false,
    setInboxPartnerFiltersArmed: vi.fn(),
    inboxWireFilter: 'all',
    setInboxWireFilter: vi.fn(),
    selectInboxPartnerForSend: vi.fn(),
    removeInboxPartnerFromQuickList: vi.fn(),
    exportEcdhMorgPkgForMessage: vi.fn(),
    onExportEinsatzberichtJson: vi.fn(),
    onExportEinsatzberichtTxt: vi.fn(),
    onExportEinsatzberichtTxtFull: vi.fn(),
    onExportEinsatzberichtEncrypted: vi.fn(),
    onExportEinsatzprotokoll: vi.fn(),
    onExportEinsatzprotokollPlainZip: vi.fn(),
    onExportEinsatzprotokollMarked: vi.fn(),
    protokollMarkedIds: new Set(),
    onHideInboxMessageLocal: vi.fn(),
    onPurgeInboxMessageChain: vi.fn(),
    onForwardMessage: vi.fn(),
    onHideAllVisibleLocal: vi.fn(),
    inboxSelectMode: false,
    setInboxSelectMode: vi.fn(),
    selectedInboxIds: new Set(),
    hiddenInboxCount: 0,
    toggleInboxSelection: vi.fn(),
    selectAllVisibleInbox: vi.fn(),
    clearInboxSelection: vi.fn(),
    onBulkHideSelected: vi.fn(),
    onBulkPurgeSelected: vi.fn(),
    toggleProtokollMark: vi.fn(),
    recipient: '',
    setStatus: vi.fn(),
    setStatusMsg: vi.fn(),
    addInboxSenderToContactBook: vi.fn(),
    onSarqNakWire: vi.fn(),
    localPurgeBusy: false,
    pinnedPinnwandIds: new Set(),
    togglePinnedPinnwand: vi.fn(),
    showPinnwandPinActions: false,
    openPartnerSetupPanel: vi.fn(),
    onOpenPhonebook: vi.fn(),
    messagingPersistenceMode: 'mailbox',
    showInboxIotaFilter: false,
    showIotaExpertInboxActions: false,
    inboxOverviewChipsVisible: false,
    inboxOverviewCategory: 'direkt',
    setInboxOverviewCategory: vi.fn(),
    inboxOverviewUnreadCounts: { alle: 0, lagebild: 0, direkt: 0, funk: 0 },
    pinnwandOverviewConfigured: false,
    isInboxMessageUnread: () => false,
    isPinnwandInboxMessage: () => false,
    showInboxPackageExpertMenu: false,
    inboxPackageFilter: '',
    packageIdSuggestions: [],
    packageIdBusy: false,
    applyTemporaryInboxPackage: vi.fn(),
    clearTemporaryInboxPackage: vi.fn(),
    applyPackageIdBackend: vi.fn(),
    setRecipient: vi.fn(),
    ...over,
  }
}

describe('useChatViewInboxPanelProps', () => {
  it('setzt messageCount und inboxRowCount', () => {
    const { result } = renderHook(() =>
      useChatViewInboxPanelProps(
        baseDeps({
          inboxTotalCount: 42,
          inboxRows: [{ id: '1' } as never],
        })
      )
    )
    expect(result.current.messageCount).toBe(42)
    expect(result.current.inboxRowCount).toBe(1)
  })

  it('ohne Expert-Menü bleibt inboxPackageExpertMenu null', () => {
    const { result } = renderHook(() =>
      useChatViewInboxPanelProps(baseDeps({ showInboxPackageExpertMenu: false }))
    )
    expect(result.current.showInboxPackageExpertMenu).toBe(false)
    expect(result.current.inboxPackageExpertMenu).toBeNull()
  })

  it('onApplySendRecipient setzt Recipient und Partner-Strip', () => {
    const setRecipient = vi.fn()
    const selectInboxPartnerForSend = vi.fn()
    const addr = '0x' + 'b'.repeat(64)
    const { result } = renderHook(() =>
      useChatViewInboxPanelProps(baseDeps({ setRecipient, selectInboxPartnerForSend }))
    )
    result.current.onApplySendRecipient?.(addr)
    expect(setRecipient).toHaveBeenCalledWith(addr)
    expect(selectInboxPartnerForSend).toHaveBeenCalledWith(addr)
  })
})
