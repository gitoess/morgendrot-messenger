'use client'

/**
 * Reine Zusammenstellung der Chat-Unterkomponenten; gesamte Logik liegt in `useChatViewCore`.
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { clearLocalHistory } from '@/frontend/lib/api'
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
import { ChatViewChatHeader, type ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import { ChatViewPinnwandContextCard } from '@/frontend/components/chat-view-pinnwand-context-card'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import {
  ChatViewTransportCard,
  type ChatViewTransportCardProps,
} from '@/frontend/components/chat-view-transport-card'
import { ChatViewSetupPanel } from '@/frontend/components/chat-view-setup-panel'
import { ChatViewGroupPanel } from '@/frontend/components/chat-view-group-panel'
import { ChatViewPhonebookSheet } from '@/frontend/components/chat-view-phonebook-sheet'
import { ContactAddAliasDialog } from '@/frontend/components/contact-add-alias-dialog'
import { isGroupChannel, isPinnwandChannel } from '@/frontend/lib/messenger-chat-channel'
import type { ChatViewCoreState } from '@/frontend/hooks/use-chat-view-core'
import { saveContactEntry, type ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { applyPhonebookContactToComposer } from '@/frontend/lib/apply-phonebook-contact'
import { recordTelegramOutgoing } from '@/frontend/lib/record-telegram-outgoing'
import { recordContactLastContacted } from '@/frontend/lib/contact-phonebook-meta-store'
import { addressMatchesIdentity } from '@/frontend/features/inbox/inbox-partner-filter'
import { resolveMeshtasticPlaintextDestination } from '@/frontend/lib/meshtastic-node-id'
import { useChatViewPendingHandshakes } from '@/frontend/hooks/use-chat-view-pending-handshakes'

export type ChatViewMainContentProps = ChatViewCoreState & {
  vaultBannerActions?: ChatViewVaultBannerActions
  channelMode?: MessengerChatChannel
  onChannelModeChange?: (c: MessengerChatChannel) => void
}

export function ChatViewMainContent(c: ChatViewMainContentProps) {
  const {
    isPrivate,
    isGroup,
    activeGroup,
    refreshMessengerGroups,
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
    apiStatus,
    refreshApiStatus,
    basisUnreachable,
    packageIdMismatch,
    deviceTimeTrustWarn,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint,
    offlineMailboxQueueItems,
    removeOfflineMailboxQueueItems,
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
    inboxTotalCount,
    messages,
    setMessages,
    loading,
    loadingMore,
    loadError,
    loadMessages,
    loadMoreInbox,
    inboxHasMore,
    appendMeshMessage,
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
    handleHandshakeForAddress,
    handleConnectAcceptPartner,
    handleConnectAcceptForAddress,
    handleConnectDeployment,
    dismissLoraOnlineFallback,
    openPartnerSetupPanel,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    meshSelfArchiveAfterLoRa,
    setMeshSelfArchiveAfterLoRa,
    protokollMarkedIds,
    pinnedPinnwandIds,
    togglePinnedPinnwand,
    toggleProtokollMark,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onForwardMessage,
    onHideAllVisibleLocal,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    hiddenInboxCount,
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
    inboxPartnerOptions,
    selectInboxPartnerForSend,
    removeInboxPartnerFromQuickList,
    resetInboxViewFilters,
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
    vaultBannerActions,
    channelMode,
    onChannelModeChange,
    inboxWireFilter,
    setInboxWireFilter,
  } = c

  const [contactAliasDialog, setContactAliasDialog] = useState<{
    address: string
    defaultLabel: string
  } | null>(null)
  const [contactAliasBusy, setContactAliasBusy] = useState(false)
  const [phonebookOpen, setPhonebookOpen] = useState(false)

  useEffect(() => {
    if (phonebookOpen) refreshContactDirectory()
  }, [phonebookOpen, refreshContactDirectory])

  const pendingHandshakeRefreshKey = `${(apiStatus?.connectedAddresses ?? []).join('|')}`

  const {
    offers: pendingHandshakeOffers,
    loading: pendingHandshakesLoading,
    reload: reloadPendingHandshakes,
  } = useChatViewPendingHandshakes({
    enabled: (isPrivate || isGroup) && encrypted && forcedTransport === 'internet',
    connectedAddresses: apiStatus?.connectedAddresses ?? [],
    refreshToken: pendingHandshakeRefreshKey,
  })

  const handleAcceptHandshakeFromInbox = useCallback(
    async (sender: string) => {
      setPartner(sender.trim())
      await handleConnectAcceptForAddress(sender)
      window.setTimeout(() => void reloadPendingHandshakes(), 4000)
    },
    [setPartner, handleConnectAcceptForAddress, reloadPendingHandshakes]
  )

  const handleUseSenderAsPartnerFromInbox = useCallback(
    (sender: string) => {
      const t = sender.trim()
      setPartner(t)
      setRecipient(t)
      toast.info('Partner-Adresse übernommen.')
    },
    [setPartner, setRecipient]
  )

  const addInboxSenderToContactBook = useCallback(
    (address: string) => {
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
      setContactAliasDialog({ address: a, defaultLabel: suggest })
    },
    [directory, myAddress, setStatus, setStatusMsg]
  )

  const saveContactAliasFromDialog = useCallback(
    async (label: string) => {
      if (!contactAliasDialog) return
      setContactAliasBusy(true)
      const r = await saveContactEntry({
        address: contactAliasDialog.address,
        label: label || undefined,
      })
      setContactAliasBusy(false)
      if (r.ok) {
        refreshContactDirectory()
        recordContactLastContacted(contactAliasDialog.address)
        setStatus('success')
        setStatusMsg(r.message || 'Kontakt gespeichert.')
        setContactAliasDialog(null)
      } else {
        setStatus('error')
        setStatusMsg(r.error || 'Kontakt speichern fehlgeschlagen.')
      }
      setTimeout(() => setStatus('idle'), 5000)
    },
    [contactAliasDialog, refreshContactDirectory, setStatus, setStatusMsg]
  )

  const onSarqNakWire = useCallback(
    async (wire: string) => {
      if (!meshtastic.connected) return
      const resolved = meshPlaintextToNodeEnabled
        ? resolveMeshtasticPlaintextDestination(true, meshPlaintextNodeId)
        : 'broadcast'
      const dest = resolved === null ? 'broadcast' : resolved
      try {
        await meshtastic.sendMeshText(wire, dest)
      } catch {
        /* NAK optional; Chat bleibt bedienbar */
      }
    },
    [meshtastic, meshPlaintextNodeId, meshPlaintextToNodeEnabled]
  )

  const applyPhonebookContact = useCallback(
    (storageKey: string, entry: ContactMeshEntryClient) => {
      const applied = applyPhonebookContactToComposer(storageKey, entry, {
        setPartner,
        setRecipient,
        setContactMeshNodeId,
        setMeshPlaintextNodeId,
        setMeshPlaintextToNodeEnabled,
        setContactBleUuid,
        selectInboxPartnerForSend,
      })
      recordContactLastContacted(applied.storageKey)
      setPhonebookOpen(false)
      const parts: string[] = []
      if (applied.iotaAddress) parts.push('IOTA')
      if (applied.telegramChatId) parts.push('Telegram')
      if (applied.meshNodeId) parts.push('Meshtastic')
      if (applied.mailboxObjectId) parts.push('Mailbox')
      toast.success(
        `${applied.label}: ${parts.length ? parts.join(', ') : 'Kontakt'} übernommen — Transport wählen und senden.`
      )
      requestAnimationFrame(() => {
        document.getElementById('chat-composer-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    },
    [
      setPartner,
      setRecipient,
      setContactMeshNodeId,
      setMeshPlaintextNodeId,
      setMeshPlaintextToNodeEnabled,
      setContactBleUuid,
      selectInboxPartnerForSend,
    ]
  )

  const applyPartnerAsSendRecipient = useCallback(() => {
    const a = partner.trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(a)) {
      toast.error('Gültige Empfänger-Wallet eingeben: 0x + 64 Hex.')
      return
    }
    setRecipient(a)
    selectInboxPartnerForSend(a)
    toast.success('Empfänger übernommen — siehe „Empfänger-Adresse“ im Composer unten.')
  }, [partner, setRecipient, selectInboxPartnerForSend])

  const handleClearLocalInboxCache = useCallback(async () => {
    if (
      !window.confirm(
        'Lokalen Klartext-Inbox-Cache auf dem Server/Rechner schreddern und löschen? Browser-Filter (ausgeblendet, nur LoRa/IOTA) werden zurückgesetzt. On-Chain-Daten bleiben.'
      )
    ) {
      return
    }
    setLocalPurgeBusy(true)
    resetInboxViewFilters()
    setMessages([])
    const r = await clearLocalHistory({ shred: true })
    setLocalPurgeBusy(false)
    if (r.ok) {
      toast.success('Cache und Anzeige-Filter zurückgesetzt — Posteingang wird neu geladen.')
    } else {
      toast.warning(
        (r.error || 'Server-Cache nicht erreichbar') +
          ' — Browser-Filter wurden trotzdem zurückgesetzt. On-Chain bleibt unverändert.'
      )
    }
    void loadMessages('reset')
  }, [loadMessages, resetInboxViewFilters, setLocalPurgeBusy, setMessages])

  const inboxPanelProps = {
    ...asInboxFeedRead(messages, myAddress),
    messageCount: inboxTotalCount,
    inboxRowCount: inboxRows.length,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    onMorgPkgImportFile,
    onMorgPkgDeviceFiles,
    morgPkgDeviceBusy,
    apiStatus,
    onRefresh: () => {
      void loadMessages('reset')
      refreshContactDirectory()
    },
    pendingHandshakeOffers,
    pendingHandshakesLoading,
    sending,
    onAcceptPendingHandshake: handleAcceptHandshakeFromInbox,
    onUseSenderAsPartnerFromInbox: handleUseSenderAsPartnerFromInbox,
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
    inboxMeshTransportOnly,
    setInboxMeshTransportOnly,
    inboxIotaTransportOnly,
    setInboxIotaTransportOnly,
    inboxWireFilter,
    setInboxWireFilter,
    selectInboxPartnerForSend,
    removeInboxPartnerFromQuickList,
    inboxRows,
    contactDirectory: directory,
    isMeshVerifiedForAddress,
    exportEcdhMorgPkgForMessage,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    protokollMarkedCount: protokollMarkedIds.size,
    protokollMarkedIds,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onForwardMessage,
    onToggleHideAllVisibleLocal: onHideAllVisibleLocal,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    hiddenInboxCount,
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
    onSarqNakWire,
    localPurgeBusy,
    onClearLocalInboxCache: () => void handleClearLocalInboxCache(),
    pinnedPinnwandIds,
    onTogglePinnedPinnwand: togglePinnedPinnwand,
    showPinnwandPinActions: channelMode != null && isPinnwandChannel(channelMode),
    showPhonebookButton: isPrivate || isGroup,
    onOpenPhonebook: () => setPhonebookOpen(true),
    onOpenPartnerSetup: openPartnerSetupPanel,
    messagingPersistenceMode,
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
    offlineMailboxQueueItems,
    onRemoveOfflineMailboxQueueItems: removeOfflineMailboxQueueItems,
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
    onManualRefresh: async () => {
      await refreshApiStatus()
      await loadMessages()
    },
    contactDirectory: directory,
    partner,
    onPartnerChange: setPartner,
    myAddress,
    onStatusFeedback: (msg, st = 'success') => {
      setStatus(st)
      setStatusMsg(msg)
    },
    onTelegramDelivered: ({ recipientKey, text }) => {
      recordTelegramOutgoing(appendMeshMessage, myAddress, recipientKey, text)
    },
  } satisfies ChatViewSendPanelProps

  const showEncryptedPartnerPanel =
    (isPrivate || isGroup) && encrypted && forcedTransport === 'internet'

  const showPartnerSetupPanel =
    (isPrivate || isGroup) &&
    (showSetup || forcedTransport === 'mesh' || forcedTransport === 'adhoc')

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
    isGroup,
    apiStatus,
    partner,
    meshBleSupported: meshtastic.bleSupported,
    meshBleConnected: meshtastic.connected,
    onOpenPartnerSetup: openPartnerSetupPanel,
    channelMode,
    myAddressLine: isPrivate ? myAddress : undefined,
    encryptedPartner: showEncryptedPartnerPanel
      ? {
          partner,
          onPartnerChange: setPartner,
          sending,
          onHandshake: handleHandshake,
          onConnectAcceptPartner: handleConnectAcceptPartner,
          onConnectDeployment: handleConnectDeployment,
          onConnectAcceptForAddress: handleConnectAcceptForAddress,
          directory,
          isGroupMode: isGroup,
          groupMemberAddresses: activeGroup?.memberAddresses ?? [],
          connectedAddresses: apiStatus?.connectedAddresses ?? [],
          onHandshakeForAddress: handleHandshakeForAddress,
        }
      : undefined,
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
        vaultBannerActions={vaultBannerActions}
        channelMode={channelMode}
        onChannelModeChange={onChannelModeChange}
        sendPath={{
          visible: isPrivate || !encrypted,
          encrypted,
          forcedTransport,
          onForcedTransportChange: setForcedTransport,
          onEncryptedChange: setEncrypted,
          myAddressLine: isPrivate ? myAddress : undefined,
        }}
      />

      {isGroup ? (
        <ChatViewGroupPanel
          contactDirectory={directory}
          onGroupsChanged={refreshMessengerGroups}
          onOpenPhonebook={() => setPhonebookOpen(true)}
        />
      ) : null}

      {channelMode != null && isPinnwandChannel(channelMode) ? (
        <ChatViewPinnwandContextCard apiStatus={apiStatus} myAddressLine={myAddress} />
      ) : null}

      {isPrivate ? (
        <ChatViewPackageIdBanner
          visible={packageIdMismatch && !!apiStatus?.packageId?.trim()}
          serverPackageId={apiStatus?.packageId?.trim() ?? ''}
          busy={packageIdBusy}
          onSyncToServer={() => void syncCanonicalPackageIdFromServer()}
        />
      ) : null}

      <ChatViewTransportCard {...transportCardProps} />

      {showPartnerSetupPanel ? (
        <ChatViewSetupPanel
          partner={partner}
          onPartnerChange={setPartner}
          sending={sending}
          onHandshake={handleHandshake}
          onConnect={handleConnectDeployment}
          isGroupMode={isGroup}
          groupMemberAddresses={activeGroup?.memberAddresses ?? []}
          connectedAddresses={apiStatus?.connectedAddresses ?? []}
          onHandshakeForAddress={handleHandshakeForAddress}
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
            meshRxSubscriptions: meshtastic.meshRxSubscriptions,
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
          role={role}
          activePackageId={apiStatus?.packageId}
          serverMailboxIdMasked={apiStatus?.mailboxIdMasked}
          mailboxConfigured={apiStatus?.mailboxConfigured}
          inboxPackageFilter={inboxPackageFilter}
          onInboxPackageFilterChange={setInboxPackageFilter}
          packageIdSuggestions={packageIdSuggestions}
          onRefreshPackageIdSuggestions={refreshPackageIdSuggestions}
          onApplyPackageIdBackend={applyPackageIdBackend}
          onApplyInboxPackageFilterOnly={applyInboxPackageFilterOnly}
          packageIdBusy={packageIdBusy}
        />
      ) : null}

      <ContactAddAliasDialog
        open={contactAliasDialog != null}
        onOpenChange={(open) => {
          if (!open) setContactAliasDialog(null)
        }}
        address={contactAliasDialog?.address ?? ''}
        defaultLabel={contactAliasDialog?.defaultLabel ?? ''}
        busy={contactAliasBusy}
        onSave={saveContactAliasFromDialog}
      />

      <section className="space-y-3 border-t border-border pt-6" aria-labelledby="chat-compose-heading">
        <h2 id="chat-compose-heading" className="text-sm font-semibold tracking-tight text-foreground">
          Nachricht verfassen
        </h2>
        <ChatViewSendPanel {...sendPanelProps} />
      </section>

      <ChatViewInboxPanel {...inboxPanelProps} />

      {(isPrivate || isGroup) ? (
        <ChatViewPhonebookSheet
          open={phonebookOpen}
          onOpenChange={setPhonebookOpen}
          directory={directory}
          refreshContactDirectory={refreshContactDirectory}
          connectedAddresses={apiStatus?.connectedAddresses ?? []}
          onSelectContact={applyPhonebookContact}
          setStatusMsg={(msg) => {
            setStatus('success')
            setStatusMsg(msg)
            setTimeout(() => setStatus('idle'), 5000)
          }}
        />
      ) : null}
    </div>
  )
}
