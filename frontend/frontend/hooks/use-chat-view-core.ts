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
import { buildForwardComposerPayload } from '@/frontend/lib/chat-forward-text'

export type UseChatViewCoreParams = {
  isPrivate: boolean
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
  const { isPrivate, role, myAddress } = p

  const [message, setMessage] = useState('')
  const [recipient, setRecipient] = useState('')
  const [partner, setPartner] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [encrypted, setEncrypted] = useState(true)
  const [bossView, setBossView] = useState(false)
  const [forcedTransport, setForcedTransport] = useState<ForcedTransport>('internet')
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
  } = useChatViewInbox({
    role,
    bossView,
    refreshContactDirectory,
    packageId: inboxPackageFilter.trim() || undefined,
  })

  const messagesSnapshotRef = useRef(messages)
  messagesSnapshotRef.current = messages

  const waitForMeshSosAckDigest = useCallback(async (digestHex: string, timeoutMs: number) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      for (const m of messagesSnapshotRef.current) {
        if (m.meshMeta?.sosAckDigest === digestHex) return true
      }
      await new Promise((r) => setTimeout(r, 380))
    }
    return false
  }, [])

  const sendSosAckBurstRef = useRef<((wire: string) => Promise<void>) | null>(null)

  const messagesForExport = useCallback(async () => {
    const fromApi = await fetchAllInboxMessagesForExport({
      packageId: inboxPackageFilter.trim() || undefined,
      bossView,
      role,
    })
    const meshOnly = messages.filter((m) => m.transports?.includes('mesh'))
    if (meshOnly.length === 0) return fromApi
    return mergeAllMessages([...fromApi, ...meshOnly])
  }, [messages, inboxPackageFilter, bossView, role])

  const [delayMirrorToIota, setDelayMirrorToIota] = useState(false)

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
    inboxPartnerOptions,
    toggleProtokollMark,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    toggleInboxSelection,
    selectAllVisibleInbox,
    clearInboxSelection,
    onHideAllVisibleLocal,
    onBulkHideSelected,
    onBulkPurgeSelected,
  } = useChatViewInboxLocalUi({
    messages,
    setMessages,
    loadMessages,
    setSending,
    setStatus,
    setStatusMsg,
    myAddress,
    contactDirectory: directory,
  })

  const { mirrorQueuePending, runMirrorDrain, onDelayMirrorPlaintext } = useChatViewMirrorDelay({
    loadMessages,
    setStatus,
    setStatusMsg,
  })
  const { apiStatus, refreshApiStatus, basisUnreachable, packageIdMismatch, deviceTimeTrustWarn } =
    useChatViewApiStatusPoll({
      runMirrorDrain,
      localPackageId: inboxPackageFilter.trim(),
      probeGeolocationForDeviceTime: isPrivate,
    })

  const {
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
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
    onMeshChatMessage: appendMeshMessage,
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
    compactFileRef,
    clearCompactAttachment,
    handleCompactAttachmentPick,
    ingestChatAttachmentFile,
  } = useChatViewAttachments({
    role,
    forcedTransport,
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
    confirmLoraSendViaOnline,
    handleSend,
  } = useChatViewSendFlow({
    isPrivate,
    encrypted,
    forcedTransport,
    recipient,
    partner,
    myAddress,
    message,
    setMessage,
    apiStatus,
    attachedLora,
    attachedBlobBase64,
    attachedTxtFile,
    attachedAudioBase64,
    clearCompactAttachment: clearCompactAttachmentAndSos,
    meshtastic,
    loadMessages,
    setMessages,
    setSending,
    setStatus,
    setStatusMsg,
    setMorgPkgDeviceBusy,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
    delayMirrorToIota,
    waitForMeshSosAckDigest,
  })

  const {
    handleHandshake,
    handleConnect,
    dismissLoraOnlineFallback,
    toggleShowSetup,
    openPartnerSetupPanel,
  } = useChatViewConnectionActions({
    partner,
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
    },
    [clearCompactAttachmentAndSos, setMessage, setStatus, setStatusMsg]
  )

  return {
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
    setShowSetup,
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
    syncCanonicalPackageIdFromServer,
    mirrorQueuePending,
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
    messages: displayMessages,
    setMessages,
    loading,
    loadingMore,
    loadError,
    loadMessages,
    loadMoreInbox,
    inboxHasMore,
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
    attachedBlobBase64,
    attachedTxtFile,
    attachedAudioBase64,
    attachedLora,
    compactMeta,
    compactPreviewUrl,
    loraPreviewUrl,
    loraOnlineFallbackOffer,
    compactBusy,
    compactFileRef,
    clearCompactAttachment: clearCompactAttachmentAndSos,
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
  }
}

export type ChatViewCoreState = ReturnType<typeof useChatViewCore>
