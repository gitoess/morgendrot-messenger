'use client'

/**
 * Gesamte Chat-View-Logik: Kontakte, Inbox (Mailbox + Mesh-Merge), Meshtastic BLE, Anhänge, Status-Polling, Send-Flow, Handshake/Schnell verbinden.
 * Meshtastic-First: Funk über `useMeshtasticBle` + Standard-Payloads; keine parallele Mesh-Implementierung hier.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { meshDecryptV2Wire, fetchAllInboxMessagesForExport } from '@/frontend/lib/api'
import { extractCompletedSlideSequences } from '@/frontend/features/inbox/inbox-slideshow'
import { buildChatInboxRows, type ChatInboxRow } from '@/frontend/features/inbox/chat-view-inbox-rows'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { useMeshtasticBle } from '@/frontend/hooks/use-meshtastic-ble'
import { sendMeshV2WireBurst } from '@/frontend/features/send/chat-view-mesh-send'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { useChatViewSendFlow } from '@/frontend/hooks/use-chat-view-send-flow'
import { useChatViewAttachments } from '@/frontend/hooks/use-chat-view-attachments'
import { useChatViewVoiceRecord } from '@/frontend/hooks/use-chat-view-voice-record'
import { useChatViewInbox } from '@/frontend/hooks/use-chat-view-inbox'
import { useChatViewEinsatzExports } from '@/frontend/hooks/use-chat-view-einsatz-exports'
import { useChatViewMirrorDelay } from '@/frontend/hooks/use-chat-view-mirror-delay'
import { useChatViewApiStatusPoll } from '@/frontend/hooks/use-chat-view-api-status-poll'
import { useChatViewMeshPanelState } from '@/frontend/hooks/use-chat-view-mesh-panel-state'
import { useChatViewInboxLocalUi } from '@/frontend/hooks/use-chat-view-inbox-local-ui'
import {
  useChatViewPackageFilterState,
  useChatViewPackageIdCommands,
} from '@/frontend/hooks/use-chat-view-package-id'
import { useChatViewConnectionActions } from '@/frontend/hooks/use-chat-view-connection-actions'
import { mergeAllMessages } from '@/frontend/lib/message-dedup'
import type { Message } from '@/frontend/lib/types'
import {
  readMessagingPersistenceModeFromStorage,
  writeMessagingPersistenceModeToStorage,
  type MessagingPersistenceMode,
} from '@/frontend/lib/messaging-persistence-mode'
import { buildForwardComposerPayload } from '@/frontend/lib/chat-forward-text'
import { toast } from 'sonner'
import {
  getActiveMessengerGroup,
  type MessengerGroupDefinition,
} from '@/frontend/lib/messenger-group-store'
import {
  isDialogChannel,
  isGroupChannel,
  isPinnwandChannel,
  type MessengerChatChannel,
} from '@/frontend/lib/messenger-chat-channel'

/** `1` = LoRa + Tangle (Delayed Mirror), sonst Nur LoRa. */
const MESH_SELF_ARCHIVE_PATH4_LS = 'morgendrot.meshSelfArchiveAfterLoRa'

export type UseChatViewCoreParams = {
  channelMode: MessengerChatChannel
  role: string
  myAddress: string
}

/**
 * Rückgabe `messages` ist die gefilterte Posteingangs-Anzeige (`displayMessages`); zusammen mit `myAddress`
 * entspricht das dem Leseschnittstellen-Typ `InboxFeedReadPort` (`features/messenger-ports`)
 * für `ChatViewInboxPanel` / Toolbar / Liste.
 *
 * `message`, `recipient`, `setMessage`, `setRecipient` bilden zusammen `ComposerDraftPort` fürs `ChatViewSendPanel`.
 * Send-Flow-Parameter enthalten `ComposerDraftSendFlowPort`; Transport-Card/Panel nutzen `SendTransportChoicePort` bzw. Leseschnitt + `SendMeshMirrorDelayPort`; Anhang-Zeile: `AttachmentBarPort`; Sprachmemo-UI: `VoiceRecordSendPanelPort` (`features/voice`-Typen + `useChatViewVoiceRecord` + `sosVoiceAwaitingSend`).
 */
export function useChatViewCore(p: UseChatViewCoreParams) {
  const { channelMode, role, myAddress } = p
  const isPrivate = isDialogChannel(channelMode)
  const isGroup = isGroupChannel(channelMode)
  const [groupsRevision, setGroupsRevision] = useState(0)
  const activeGroup: MessengerGroupDefinition | null = useMemo(() => {
    if (!isGroup) return null
    void groupsRevision
    return getActiveMessengerGroup()
  }, [isGroup, groupsRevision])
  const groupMemberFilter = isGroup && activeGroup ? activeGroup.memberAddresses : null
  const refreshMessengerGroups = useCallback(() => setGroupsRevision((n) => n + 1), [])

  const [message, setMessage] = useState('')
  const [recipient, setRecipient] = useState('')
  const [partner, setPartner] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [encrypted, setEncryptedInternal] = useState(true)
  const [forcedTransport, setForcedTransportInternal] = useState<ForcedTransport>('internet')

  /** Verschlüsselter Funk (Mesh v2 / PRIVATE_APP) ist produktseitig abgeschaltet — Funk = Klartext; Verschlüsselung nur Online/IOTA. */
  const setForcedTransport = useCallback((t: ForcedTransport) => {
    if (t === 'mesh') setEncryptedInternal(false)
    setForcedTransportInternal(t)
  }, [])

  const setEncrypted = useCallback(
    (v: boolean) => {
      if (v && forcedTransport === 'mesh') setForcedTransportInternal('internet')
      setEncryptedInternal(v)
    },
    [forcedTransport]
  )

  /** Pinnwand: verschlüsselter Funk ist ohnehin gesperrt — Klartext konsistent setzen. */
  useEffect(() => {
    if (!isPrivate) setEncryptedInternal(false)
  }, [isPrivate])

  useEffect(() => {
    if (!encrypted) setShowSetup(false)
  }, [encrypted])

  /** Nach SOS-Sprache: Hinweis + optional „Jetzt senden“, bis Anhang weg oder ersetzt. */
  const [sosVoiceAwaitingSend, setSosVoiceAwaitingSend] = useState(false)
  const clearSosVoicePrompt = useCallback(() => setSosVoiceAwaitingSend(false), [])
  const [morgPkgDeviceBusy, setMorgPkgDeviceBusy] = useState(false)
  const morgPkgFileRef = useRef<HTMLInputElement>(null)
  const morgPkgDeviceFilesRef = useRef<HTMLInputElement>(null)

  /** Posteingang `/inbox` mit dieser Package-ID (0x…); leer = Backend-Default aus .env. */
  const {
    inboxPackageFilter,
    setInboxPackageFilter,
    packageIdSuggestions,
    setPackageIdSuggestions,
    packageIdBusy,
    setPackageIdBusy,
  } = useChatViewPackageFilterState()

  const { directory, refresh: refreshContactDirectory, isMeshVerifiedForAddress } = useContactDirectory()

  const {
    messages,
    setMessages,
    loading,
    loadingMore,
    loadError,
    loadMessages,
    loadMoreInbox,
    inboxHasMore,
    appendMeshMessage,
    clearInboxRam,
  } = useChatViewInbox({
    refreshContactDirectory,
    packageId: inboxPackageFilter.trim() || undefined,
    myAddress,
  })

  const sendSosAckBurstRef = useRef<((wire: string) => Promise<void>) | null>(null)
  const meshInboundTextBufferRef = useRef<string[]>([])

  const clearMeshInboundText = useCallback(() => {
    meshInboundTextBufferRef.current = []
  }, [])

  const drainMeshInboundText = useCallback((): string[] => {
    const out = meshInboundTextBufferRef.current
    meshInboundTextBufferRef.current = []
    return out
  }, [])

  const appendMeshMessageWithInboundCapture = useCallback(
    (msg: Message) => {
      if (msg.source === 'mesh' && typeof msg.content === 'string' && msg.content.includes('MORG_NAK_V1')) {
        meshInboundTextBufferRef.current.push(msg.content)
        if (meshInboundTextBufferRef.current.length > 64) {
          meshInboundTextBufferRef.current.shift()
        }
      }
      appendMeshMessage(msg)
    },
    [appendMeshMessage]
  )

  const messagesForExport = useCallback(async () => {
    const fromApi = await fetchAllInboxMessagesForExport({
      packageId: inboxPackageFilter.trim() || undefined,
      bossView: false,
      role,
    })
    const meshOnly = messages.filter((m) => m.transports?.includes('mesh'))
    if (meshOnly.length === 0) return fromApi
    return mergeAllMessages([...fromApi, ...meshOnly])
  }, [messages, inboxPackageFilter, role])

  const [meshSelfArchiveAfterLoRa, setMeshSelfArchiveAfterLoRaState] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(MESH_SELF_ARCHIVE_PATH4_LS) === '1'
    } catch {
      return false
    }
  })
  const setMeshSelfArchiveAfterLoRa = useCallback((v: boolean) => {
    setMeshSelfArchiveAfterLoRaState(v)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(MESH_SELF_ARCHIVE_PATH4_LS, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (forcedTransport !== 'mesh') {
      setMeshSelfArchiveAfterLoRa(false)
    }
  }, [forcedTransport, setMeshSelfArchiveAfterLoRa])

  const [messagingPersistenceMode, setMessagingPersistenceModeState] = useState<MessagingPersistenceMode>(() =>
    readMessagingPersistenceModeFromStorage()
  )
  const setMessagingPersistenceMode = useCallback((m: MessagingPersistenceMode) => {
    setMessagingPersistenceModeState(m)
    writeMessagingPersistenceModeToStorage(m)
  }, [])

  /** Optional: Fortschrittszeile für die Anhang-Leiste beim LoRa-Bild (z. B. SOS-/Retry-Text). */
  const [loraMeshProgressLine, setLoraMeshProgressLine] = useState<string | null>(null)

  const {
    protokollMarkedIds,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    displayMessages,
    filteredDisplayMessages,
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
    inboxPartnerOptions,
    toggleProtokollMark,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    toggleInboxSelection,
    selectAllVisibleInbox,
    clearInboxSelection,
    onHideAllVisibleLocal,
    hiddenInboxCount,
    onBulkHideSelected,
    onBulkPurgeSelected,
    removeInboxPartnerFromQuickList,
    resetInboxViewFilters,
    inboxVisibilityHint,
    pinnedPinnwandIds,
    togglePinnedPinnwand,
  } = useChatViewInboxLocalUi({
    messages,
    setMessages,
    loadMessages,
    setSending,
    setStatus,
    setStatusMsg,
    myAddress,
    contactDirectory: directory,
    groupMemberFilter,
    isGroupMode: isGroup,
    isPinnwandMode: isPinnwandChannel(channelMode),
  })

  useEffect(() => {
    if (isGroup) setInboxPartnerKey(null)
  }, [isGroup, setInboxPartnerKey])

  const {
    mirrorQueuePending,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint,
    offlineMailboxQueueItems,
    refreshOfflineMailboxQueueCount,
    removeOfflineMailboxQueueItems,
    runMirrorDrain,
    runOfflineMailboxDrain,
    onDelayMirrorPlaintext,
  } = useChatViewMirrorDelay({
    loadMessages,
    setStatus,
    setStatusMsg,
    mailboxRecipient: recipient,
    senderAddress: myAddress,
  })
  const { apiStatus, refreshApiStatus, basisUnreachable, packageIdMismatch, deviceTimeTrustWarn } =
    useChatViewApiStatusPoll({
      runMirrorDrain,
      runOfflineMailboxDrain,
      pollInbox: () => loadMessages('poll', undefined, { silent: true }),
      localPackageId: inboxPackageFilter.trim(),
      probeGeolocationForDeviceTime: isPrivate,
    })

  /** Falsche Package-ID im Posteingang-Feld → leeren (Backend-.env), sonst leerer/falscher /inbox. */
  useEffect(() => {
    if (!packageIdMismatch) return
    setInboxPackageFilter((prev) => (prev.trim() ? '' : prev))
  }, [packageIdMismatch, setInboxPackageFilter])

  /** M3: Broadcast-Adresse aus /api/status ins Empfängerfeld (Pinnwand-Kanal). */
  useEffect(() => {
    if (!isPinnwandChannel(channelMode)) return
    const addr = apiStatus?.broadcastPinnwand?.address?.trim() ?? ''
    if (!addr || !/^0x[a-fA-F0-9]{64}$/i.test(addr)) return
    setRecipient((prev) => (prev.trim() ? prev : addr))
  }, [channelMode, apiStatus?.broadcastPinnwand?.address])

  const {
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    onExportEinsatzberichtEncrypted,
  } = useChatViewEinsatzExports({
    messagesLength: messages.length,
    messagesForExport,
    myAddress,
    protokollMarkedIds,
    setStatus,
    setStatusMsg,
    deviceTimeTrustWarn,
  })

  const selectInboxPartnerForSend = useCallback(
    (address: string) => {
      setRecipient(address.trim())
      setInboxPartnerKey(address.trim())
    },
    [setRecipient, setInboxPartnerKey]
  )

  const decryptMeshWire = useCallback(async (senderAddress: string, fullWire: Uint8Array) => {
    const { uint8ArrayToBase64 } = await import('@/frontend/lib/emergency-binary-browser')
    const r = await meshDecryptV2Wire(senderAddress, uint8ArrayToBase64(fullWire))
    return r.ok && r.text ? r.text : null
  }, [])

  const slideSequences = useMemo(
    () => extractCompletedSlideSequences(filteredDisplayMessages),
    [filteredDisplayMessages]
  )

  const inboxRows = useMemo(
    (): ChatInboxRow[] => buildChatInboxRows(filteredDisplayMessages, slideSequences),
    [filteredDisplayMessages, slideSequences]
  )

  const meshtastic = useMeshtasticBle({
    contactDirectory: directory,
    onMeshChatMessage: appendMeshMessageWithInboundCapture,
    decryptMeshV2Wire: decryptMeshWire,
    onDelayMirrorPlaintext,
    sendSosAckBurstRef,
    shouldAutoAckSosMesh: () => {
      if (typeof window === 'undefined') return false
      try {
        return window.localStorage.getItem('morgendrot.sosAutoMeshAckReply') === '1'
      } catch {
        return false
      }
    },
  })

  useEffect(() => {
    sendSosAckBurstRef.current = async (ackWire: string) => {
      if (!meshtastic.connected) return
      await sendMeshV2WireBurst(
        ackWire,
        meshtastic.sendBinaryV2.bind(meshtastic),
        undefined,
        { priorityFlash: true }
      )
    }
  }, [meshtastic.connected, meshtastic.sendBinaryV2])

  const {
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
  } = useChatViewMeshPanelState()

  const {
    attachedBlobBase64,
    attachedTxtFile,
    attachedAudioBase64,
    attachedLora,
    compactMeta,
    compactPreviewUrl,
    loraPreviewUrl,
    loraOnlineFallbackOffer,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
    compactBusy,
    attachmentPipelineHint,
    compactFileRef,
    clearCompactAttachment,
    handleCompactAttachmentPick,
    ingestChatAttachmentFile,
  } = useChatViewAttachments({
    role,
    isPrivate,
    encrypted,
    forcedTransport,
    meshSelfArchiveAfterLoRa,
    setStatus,
    setStatusMsg,
    onCompactIngestStart: clearSosVoicePrompt,
  })

  const clearCompactAttachmentAndSos = useCallback(() => {
    clearCompactAttachment()
    setSosVoiceAwaitingSend(false)
  }, [clearCompactAttachment])

  const {
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
  } = useChatViewVoiceRecord({
    forcedTransport,
    ingestChatAttachmentFile,
    setStatus,
    setStatusMsg,
    onEmergencyVoiceReady: () => setSosVoiceAwaitingSend(true),
    blocked: sending || compactBusy,
  })

  const {
    exportEcdhMorgPkgForMessage,
    onMorgPkgDeviceFiles,
    onMorgPkgImportFile,
    runMorgPkgDeviceExportPick,
    confirmLoraSendViaOnline,
    handleSend,
    cancelSend,
  } = useChatViewSendFlow({
    isPrivate,
    encrypted,
    forcedTransport,
    messagingPersistenceMode,
    recipient,
    partner,
    myAddress,
    message,
    setMessage,
    apiStatus,
    refreshApiStatus,
    attachedLora,
    attachedBlobBase64,
    attachedTxtFile,
    attachedAudioBase64,
    clearCompactAttachment: clearCompactAttachmentAndSos,
    meshtastic,
    loadMessages,
    setMessages,
    appendMeshMessage,
    setSending,
    setStatus,
    setStatusMsg,
    setMorgPkgDeviceBusy,
    morgPkgDeviceBusy,
    morgPkgDeviceFilesRef,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
    meshSelfArchiveAfterLoRa,
    setMeshProgress: setLoraMeshProgressLine,
    onOfflineMailboxQueueChanged: refreshOfflineMailboxQueueCount,
    deviceTimeTrustWarn,
    meshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    clearMeshInboundText,
    drainMeshInboundText,
    contactDirectory: directory,
    activeGroup,
    isGroupChannel: isGroup,
  })

  const {
    handleHandshake,
    handleHandshakeForAddress,
    handleConnectAcceptPartner,
    handleConnectAcceptForAddress,
    handleConnectDeployment,
    dismissLoraOnlineFallback,
    toggleShowSetup,
    openPartnerSetupPanel,
  } = useChatViewConnectionActions({
    partner,
    refreshApiStatus,
    setSending,
    setStatus,
    setStatusMsg,
    setShowSetup,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
  })

  const {
    refreshPackageIdSuggestions,
    applyPackageIdBackend,
    applyInboxPackageFilterOnly,
  } = useChatViewPackageIdCommands({
    showSetup,
    inboxPackageFilter,
    setInboxPackageFilter,
    setPackageIdSuggestions,
    setPackageIdBusy,
    loadMessages,
    refreshApiStatus,
    setStatus,
    setStatusMsg,
  })

  /** Kanonische ID von /api/status übernehmen (= /set-package-id + Posteingang neu). */
  const syncCanonicalPackageIdFromServer = useCallback(() => {
    const raw = apiStatus?.packageId?.trim() ?? ''
    void applyPackageIdBackend(raw)
  }, [apiStatus?.packageId, applyPackageIdBackend])

  const onForwardMessage = useCallback(
    (msg: Message, includeSender: boolean) => {
      clearCompactAttachmentAndSos()
      setMessage(buildForwardComposerPayload(msg, includeSender))
      setStatus('success')
      setStatusMsg('Text ins Eingabefeld übernommen – Empfänger prüfen und senden.')
      toast.success('Weiterleiten: Text im Nachrichtenfeld — Empfänger prüfen und senden.')
      requestAnimationFrame(() => {
        document.getElementById('chat-composer-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    },
    [clearCompactAttachmentAndSos, setMessage, setStatus, setStatusMsg]
  )

  return {
    channelMode,
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
    setShowSetup,
    toggleShowSetup,
    encrypted,
    setEncrypted,
    apiStatus,
    refreshApiStatus,
    basisUnreachable,
    packageIdMismatch,
    deviceTimeTrustWarn,
    syncCanonicalPackageIdFromServer,
    mirrorQueuePending,
    offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount,
    offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint,
    offlineMailboxQueueItems,
    removeOfflineMailboxQueueItems,
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
    /** Posteingang: Zähler = sichtbare Zeilen nach Partner/Richtung/Transport-Filtern. */
    inboxTotalCount: filteredDisplayMessages.length,
    messages: displayMessages,
    setMessages,
    loading,
    loadingMore,
    loadError,
    loadMessages,
    loadMoreInbox,
    inboxHasMore,
    appendMeshMessage,
    clearInboxRam,
    slideSequences,
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
    clearCompactAttachment: clearCompactAttachmentAndSos,
    handleCompactAttachmentPick,
    ingestChatAttachmentFile,
    exportEcdhMorgPkgForMessage,
    onMorgPkgDeviceFiles,
    onMorgPkgImportFile,
    onMorgPkgDeviceExportPick: runMorgPkgDeviceExportPick,
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
    hiddenInboxCount,
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
    inboxWireFilter,
    setInboxWireFilter,
    inboxPartnerOptions,
    selectInboxPartnerForSend,
    removeInboxPartnerFromQuickList,
    resetInboxViewFilters,
    inboxVisibilityHint,
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
  }
}

export type ChatViewCoreState = ReturnType<typeof useChatViewCore>
