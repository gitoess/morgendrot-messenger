'use client'

/**
 * Reine Zusammenstellung der Chat-Unterkomponenten; gesamte Logik liegt in `useChatViewCore`.
 */

import { useCallback } from 'react'
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
import { saveContactEntry } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { addressMatchesIdentity } from '@/frontend/features/inbox/inbox-partner-filter'

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
    offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint,
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
    messagingPersistenceMode,
    setMessagingPersistenceMode,
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
    contactMeshNodeId,
    setContactMeshNodeId,
    meshPlaintextToNodeEnabled,
    setMeshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    setMeshPlaintextNodeId,
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
    attachmentPipelineHint,
    compactFileRef,
    clearCompactAttachment,
    handleCompactAttachmentPick,
    ingestChatAttachmentFile,
    exportEcdhMorgPkgForMessage,
    onMorgPkgDeviceFiles,
    onMorgPkgImportFile,
    confirmLoraSendViaOnline,
    handleSend,
    cancelSend,
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
    meshSelfArchiveAfterLoRa,
    setMeshSelfArchiveAfterLoRa,
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
    inboxMeshTransportOnly,
    setInboxMeshTransportOnly,
    inboxIotaTransportOnly,
    setInboxIotaTransportOnly,
    inboxPartnerOptionsMesh,
    inboxPartnerOptionsIota,
    selectInboxPartnerForSend,
    removeInboxPartnerFromQuickList,
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

  const addInboxSenderToContactBook = useCallback(
    async (address: string) => {
      const a = address.trim()
      if (!a.startsWith('0x') || a.length < 66) {
        setStatus('error')
        setStatusMsg('Keine gültige 0x-Absenderadresse.')
        setTimeout(() => setStatus('idle'), 4000)
        return
      }
      if (myAddress.trim() && addressMatchesIdentity(a, myAddress)) {
        setStatus('error')
        setStatusMsg('Das ist deine eigene Adresse — nicht ins Telefonbuch nötig.')
        setTimeout(() => setStatus('idle'), 4000)
        return
      }
      const suggest = contactDisplayLabel(directory, a) || `${a.slice(0, 10)}…${a.slice(-4)}`
      const label = window.prompt('Name im Telefonbuch (leer = Kurzadresse im Chat)', suggest)
      if (label === null) return
      const r = await saveContactEntry({ address: a, label: label.trim() || undefined })
      if (r.ok) {
        refreshContactDirectory()
        setStatus('success')
        setStatusMsg(r.message || 'Kontakt gespeichert.')
      } else {
        setStatus('error')
        setStatusMsg(r.error || 'Kontakt speichern fehlgeschlagen.')
      }
      setTimeout(() => setStatus('idle'), 5000)
    },
    [directory, myAddress, refreshContactDirectory, setStatus, setStatusMsg]
  )

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
    inboxPartnerOptionsMesh,
    inboxPartnerOptionsIota,
    inboxPartnerKey,
    setInboxPartnerKey,
    inboxDirectionFilter,
    setInboxDirectionFilter,
    inboxMeshTransportOnly,
    setInboxMeshTransportOnly,
    inboxIotaTransportOnly,
    setInboxIotaTransportOnly,
    selectInboxPartnerForSend,
    removeInboxPartnerFromQuickList,
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
    onAddSenderToContactBook: addInboxSenderToContactBook,
  } satisfies ChatViewInboxPanelProps

  const sendPanelProps = {
    ...asComposerDraft(message, recipient, setMessage, setRecipient),
    ...asSendTransportRead(encrypted, forcedTransport),
    ...asSendMeshMirrorDelay(meshSelfArchiveAfterLoRa, setMeshSelfArchiveAfterLoRa),
    isPrivate,
    sending,
    loraOnlineFallbackOffer,
    onConfirmLoraOnline: confirmLoraSendViaOnline,
    onDismissLoraOnlineFallback: dismissLoraOnlineFallback,
    apiStatus,
    onSend: handleSend,
    onCancelSend: cancelSend,
    status,
    statusMsg,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint,
    meshPlaintextToNodeEnabled,
    onMeshPlaintextToNodeEnabledChange: setMeshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    onMeshPlaintextNodeIdChange: setMeshPlaintextNodeId,
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
    attachmentPipelineHint,
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
    ...asSendTransportChoice(
      encrypted,
      setEncrypted,
      forcedTransport,
      setForcedTransport,
      messagingPersistenceMode,
      setMessagingPersistenceMode
    ),
    isPrivate,
    apiStatus,
    meshBleSupported: meshtastic.bleSupported,
    meshBleConnected: meshtastic.connected,
    onOpenPartnerSetup: openPartnerSetupPanel,
    partnerSetupOpen: showSetup,
    onTogglePartnerSetup: toggleShowSetup,
  } satisfies ChatViewTransportCardProps

  return (
    <div className="space-y-8">
      <ChatViewChatHeader
        isPrivate={isPrivate}
        encrypted={encrypted}
        apiStatus={apiStatus}
        onRefreshStatus={refreshApiStatus}
        basisUnreachable={basisUnreachable}
        meshBleConnected={meshtastic.connected}
        role={role}
        deviceTimeTrustWarn={deviceTimeTrustWarn}
        sendPath={{
          visible: isPrivate || !encrypted,
          encrypted,
          forcedTransport,
          onForcedTransportChange: setForcedTransport,
          onEncryptedChange: setEncrypted,
        }}
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
          encrypted={encrypted}
          forcedTransport={forcedTransport}
          meshtastic={{
            bleSupported: meshtastic.bleSupported,
            serialSupported: meshtastic.serialSupported,
            transportKind: meshtastic.transportKind,
            connected: meshtastic.connected,
            connecting: meshtastic.connecting,
            error: meshtastic.error,
            lastRxDebug: meshtastic.lastRxDebug,
            connect: meshtastic.connect,
            connectBluetooth: meshtastic.connectBluetooth,
            connectUsb: meshtastic.connectUsb,
            disconnect: meshtastic.disconnect,
          }}
          directory={directory}
          refreshContactDirectory={refreshContactDirectory}
          contactBleAddress={contactBleAddress}
          onContactBleAddressChange={setContactBleAddress}
          contactBleUuid={contactBleUuid}
          onContactBleUuidChange={setContactBleUuid}
          contactMeshNodeId={contactMeshNodeId}
          onContactMeshNodeIdChange={setContactMeshNodeId}
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

      <section className="space-y-3 border-t border-border pt-6" aria-labelledby="chat-compose-heading">
        <h2 id="chat-compose-heading" className="text-sm font-semibold tracking-tight text-foreground">
          Nachricht verfassen
        </h2>
        <ChatViewSendPanel {...sendPanelProps} />
      </section>

      <ChatViewInboxPanel {...inboxPanelProps} />
    </div>
  )
}
