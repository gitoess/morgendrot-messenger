'use client'

/**
 * Reine Zusammenstellung der Chat-Unterkomponenten; gesamte Logik liegt in `useChatViewCore`.
 */

import { ChatViewInboxPanel, type ChatViewInboxPanelProps } from '@/frontend/components/chat-view-inbox-panel'
import {
  asComposerDraft,
  asInboxFeedRead,
  asSendMeshMirrorDelay,
  asSendTransportChoice,
  asSendTransportRead,
  asVoiceRecordSendPanel,
} from '@/frontend/features/messenger-ports'
import { ChatViewPackageIdBanner } from '@/frontend/components/chat-view-package-id-banner'
import { ChatViewSendPanel, type ChatViewSendPanelProps } from '@/frontend/components/chat-view-send-panel'
import { ChatViewChatHeader } from '@/frontend/components/chat-view-chat-header'
import {
  ChatViewTransportCard,
  type ChatViewTransportCardProps,
} from '@/frontend/components/chat-view-transport-card'
import { ChatViewSetupPanel } from '@/frontend/components/chat-view-setup-panel'
import type { ChatViewCoreState } from '@/frontend/hooks/use-chat-view-core'

export type ChatViewMainContentProps = ChatViewCoreState

export function ChatViewMainContent(c: ChatViewMainContentProps) {
  const {
    isPrivate,
    role,
    myAddress,
    message,
    setMessage,
    recipient,
    setRecipient,
    partner,
    setPartner,
    sending,
    status,
    statusMsg,
    setStatus,
    setStatusMsg,
    showSetup,
    toggleShowSetup,
    encrypted,
    setEncrypted,
    bossView,
    setBossView,
    apiStatus,
    refreshApiStatus,
    basisUnreachable,
    packageIdMismatch,
    deviceTimeTrustWarn,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    syncCanonicalPackageIdFromServer,
    inboxPackageFilter,
    setInboxPackageFilter,
    packageIdSuggestions,
    refreshPackageIdSuggestions,
    applyPackageIdBackend,
    applyInboxPackageFilterOnly,
    packageIdBusy,
    forcedTransport,
    setForcedTransport,
    morgPkgDeviceBusy,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    directory,
    refreshContactDirectory,
    isMeshVerifiedForAddress,
    messages,
    setMessages,
    loading,
    loadingMore,
    loadError,
    loadMessages,
    loadMoreInbox,
    inboxHasMore,
    inboxRows,
    meshtastic,
    meshExportPw,
    setMeshExportPw,
    meshImportPw,
    setMeshImportPw,
    meshImportJson,
    setMeshImportJson,
    meshSyncBusy,
    setMeshSyncBusy,
    meshSyncMsg,
    setMeshSyncMsg,
    localPurgeBusy,
    setLocalPurgeBusy,
    contactBleAddress,
    setContactBleAddress,
    contactBleUuid,
    setContactBleUuid,
    contactBleBusy,
    setContactBleBusy,
    attachedBlobBase64,
    attachedTxtFile,
    attachedAudioBase64,
    attachedLora,
    compactMeta,
    compactPreviewUrl,
    loraPreviewUrl,
    loraMeshProgressLine,
    loraOnlineFallbackOffer,
    compactBusy,
    compactFileRef,
    clearCompactAttachment,
    handleCompactAttachmentPick,
    ingestChatAttachmentFile,
    exportEcdhMorgPkgForMessage,
    onMorgPkgDeviceFiles,
    onMorgPkgImportFile,
    confirmLoraSendViaOnline,
    handleSend,
    handleHandshake,
    handleConnect,
    dismissLoraOnlineFallback,
    openPartnerSetupPanel,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    delayMirrorToIota,
    setDelayMirrorToIota,
    protokollMarkedIds,
    toggleProtokollMark,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onForwardMessage,
    onHideAllVisibleLocal,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    toggleInboxSelection,
    selectAllVisibleInbox,
    clearInboxSelection,
    onBulkHideSelected,
    onBulkPurgeSelected,
    inboxPartnerKey,
    setInboxPartnerKey,
    inboxDirectionFilter,
    setInboxDirectionFilter,
    inboxPartnerOptions,
    selectInboxPartnerForSend,
    voicePhase,
    voiceActiveKind,
    voiceProgress01,
    voiceBusy,
    voiceRecording,
    onVoiceToggle,
    onVoiceEmergencyToggle,
    voiceNormalBlockedStart,
    voiceEmergencyBlockedStart,
    voiceMaxSeconds,
    voiceEmergencyMaxSeconds,
    sosVoiceFollowsOnline,
    sosVoiceAwaitingSend,
  } = c

  const inboxPanelProps = {
    ...asInboxFeedRead(messages, myAddress),
    messageCount: messages.length,
    inboxRowCount: inboxRows.length,
    role,
    bossView,
    onBossViewChange: setBossView,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    onMorgPkgImportFile,
    onMorgPkgDeviceFiles,
    morgPkgDeviceBusy,
    apiStatus,
    onRefresh: () => void loadMessages('reset'),
    loading,
    loadingMore,
    loadMoreInbox,
    inboxHasMore,
    loadError,
    basisUnreachable,
    inboxPartnerOptions,
    inboxPartnerKey,
    setInboxPartnerKey,
    inboxDirectionFilter,
    setInboxDirectionFilter,
    selectInboxPartnerForSend,
    inboxRows,
    contactDirectory: directory,
    isMeshVerifiedForAddress,
    exportEcdhMorgPkgForMessage,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    protokollMarkedCount: protokollMarkedIds.size,
    protokollMarkedIds,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onForwardMessage,
    onHideAllVisibleLocal,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    toggleInboxSelection,
    onSelectAllVisible: selectAllVisibleInbox,
    onClearInboxSelection: clearInboxSelection,
    onBulkHideSelected,
    onBulkPurgeSelected,
    toggleProtokollMark,
    recipient,
    setStatus,
    setStatusMsg,
  } satisfies ChatViewInboxPanelProps

  const sendPanelProps = {
    ...asComposerDraft(message, recipient, setMessage, setRecipient),
    ...asSendTransportRead(encrypted, forcedTransport),
    ...asSendMeshMirrorDelay(delayMirrorToIota, setDelayMirrorToIota),
    isPrivate,
    sending,
    loraOnlineFallbackOffer,
    onConfirmLoraOnline: confirmLoraSendViaOnline,
    onDismissLoraOnlineFallback: dismissLoraOnlineFallback,
    apiStatus,
    onSend: handleSend,
    status,
    statusMsg,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    ...asVoiceRecordSendPanel(
      {
        voicePhase,
        voiceActiveKind,
        voiceProgress01,
        voiceMaxSeconds,
        voiceEmergencyMaxSeconds,
        sosVoiceFollowsOnline,
        onVoiceToggle,
        onVoiceEmergencyToggle,
        voiceNormalBlockedStart,
        voiceEmergencyBlockedStart,
        voiceBusy,
        voiceRecording,
      },
      sosVoiceAwaitingSend
    ),
    forcedTransport,
    compactFileRef,
    compactBusy,
    onFileChange: handleCompactAttachmentPick,
    ingestChatAttachmentFile,
    compactMeta,
    attachedBlobBase64,
    attachedLora,
    attachedTxtFile,
    attachedAudioBase64,
    clearCompactAttachment,
    compactPreviewUrl,
    loraPreviewUrl,
    loraMeshProgressLine,
  } satisfies ChatViewSendPanelProps

  const transportCardProps = {
    ...asSendTransportChoice(encrypted, setEncrypted, forcedTransport, setForcedTransport),
    isPrivate,
    apiStatus,
    meshBleSupported: meshtastic.bleSupported,
    meshBleConnected: meshtastic.connected,
    onOpenPartnerSetup: openPartnerSetupPanel,
  } satisfies ChatViewTransportCardProps

  return (
    <div className="space-y-6">
      <ChatViewChatHeader
        isPrivate={isPrivate}
        encrypted={encrypted}
        showSetup={showSetup}
        onToggleSetup={toggleShowSetup}
        apiStatus={apiStatus}
        onRefreshStatus={refreshApiStatus}
        basisUnreachable={basisUnreachable}
        meshBleConnected={meshtastic.connected}
        role={role}
        deviceTimeTrustWarn={deviceTimeTrustWarn}
      />

      {isPrivate ? (
        <ChatViewPackageIdBanner
          visible={packageIdMismatch && !!apiStatus?.packageId?.trim()}
          serverPackageId={apiStatus?.packageId?.trim() ?? ''}
          busy={packageIdBusy}
          onSyncToServer={() => void syncCanonicalPackageIdFromServer()}
        />
      ) : null}

      <ChatViewTransportCard {...transportCardProps} />

      {isPrivate && showSetup && (
        <ChatViewSetupPanel
          partner={partner}
          onPartnerChange={setPartner}
          sending={sending}
          onHandshake={handleHandshake}
          onConnect={handleConnect}
          meshtastic={{
            bleSupported: meshtastic.bleSupported,
            connected: meshtastic.connected,
            connecting: meshtastic.connecting,
            error: meshtastic.error,
            connect: meshtastic.connect,
            disconnect: meshtastic.disconnect,
          }}
          directory={directory}
          refreshContactDirectory={refreshContactDirectory}
          contactBleAddress={contactBleAddress}
          onContactBleAddressChange={setContactBleAddress}
          contactBleUuid={contactBleUuid}
          onContactBleUuidChange={setContactBleUuid}
          contactBleBusy={contactBleBusy}
          setContactBleBusy={setContactBleBusy}
          meshExportPw={meshExportPw}
          onMeshExportPwChange={setMeshExportPw}
          meshImportPw={meshImportPw}
          onMeshImportPwChange={setMeshImportPw}
          meshImportJson={meshImportJson}
          onMeshImportJsonChange={setMeshImportJson}
          meshSyncBusy={meshSyncBusy}
          setMeshSyncBusy={setMeshSyncBusy}
          meshSyncMsg={meshSyncMsg}
          setMeshSyncMsg={setMeshSyncMsg}
          localPurgeBusy={localPurgeBusy}
          setLocalPurgeBusy={setLocalPurgeBusy}
          setMessages={setMessages}
          role={role}
          activePackageId={apiStatus?.packageId}
          inboxPackageFilter={inboxPackageFilter}
          onInboxPackageFilterChange={setInboxPackageFilter}
          packageIdSuggestions={packageIdSuggestions}
          onRefreshPackageIdSuggestions={refreshPackageIdSuggestions}
          onApplyPackageIdBackend={applyPackageIdBackend}
          onApplyInboxPackageFilterOnly={applyInboxPackageFilterOnly}
          packageIdBusy={packageIdBusy}
        />
      )}

      <ChatViewSendPanel {...sendPanelProps} />

      <ChatViewInboxPanel {...inboxPanelProps} />
    </div>
  )
}
