'use client'

/**
 * Send-Schicht: Meshtastic BLE, Anhänge, Sprachmemo, Send-Flow, Verbindung/Handshake.
 * Aus use-chat-view-core extrahiert (P1 Port-Assembler-Scheibe).
 */

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { meshDecryptV2Wire } from '@/frontend/lib/api'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { sendMeshV2WireBurst } from '@/frontend/features/send/chat-view-mesh-send'
import { useMeshtasticBle } from '@/frontend/hooks/use-meshtastic-ble'
import { useChatViewMeshPanelState } from '@/frontend/hooks/use-chat-view-mesh-panel-state'
import { useChatViewAttachments } from '@/frontend/hooks/use-chat-view-attachments'
import { useChatViewVoiceRecord } from '@/frontend/hooks/use-chat-view-voice-record'
import { useChatViewSendFlow } from '@/frontend/hooks/use-chat-view-send-flow'
import { useChatViewConnectionActions } from '@/frontend/hooks/use-chat-view-connection-actions'
import { buildForwardComposerPayload } from '@/frontend/lib/chat-forward-text'
import { applyMorgPkgItemToComposer } from '@/frontend/lib/apply-morg-pkg-item-to-composer'
import type { MorgPkgImportItem } from '@/frontend/lib/morg-pkg-import-store'
import { toast } from 'sonner'
import type { Message } from '@/frontend/lib/types'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import { isPinnwandChannel, type MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { AppendMeshMessageFn } from '@/frontend/lib/append-mesh-message-fn'

export type UseChatViewSendOrchestrationParams = {
  channelMode: MessengerChatChannel
  role: string
  myAddress: string
  isPrivate: boolean
  isGroup: boolean
  activeGroup: MessengerGroupDefinition | null
  message: string
  setMessage: (v: string) => void
  recipient: string
  setRecipient: (v: string) => void
  partner: string
  encrypted: boolean
  forcedTransport: ForcedTransport
  messagingPersistenceMode: MessagingPersistenceMode
  composerMailboxObjectId: string
  sending: boolean
  setSending: (v: boolean) => void
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  showSetup: boolean
  setShowSetup: Dispatch<SetStateAction<boolean>>
  meshLoRaImagesEnabled: boolean
  meshSelfArchiveAfterLoRa: boolean
  meshtasticChannelIndex?: number
  morgPkgDeviceBusy: boolean
  setMorgPkgDeviceBusy: (v: boolean) => void
  morgPkgFileRef: React.RefObject<HTMLInputElement | null>
  morgPkgDeviceFilesRef: React.RefObject<HTMLInputElement | null>
  setLoraMeshProgressLine: (v: string | null) => void
  sosVoiceAwaitingSend: boolean
  setSosVoiceAwaitingSend: (v: boolean) => void
  clearSosVoicePrompt: () => void
  apiStatus: ApiStatus | null
  refreshApiStatus: () => void | Promise<void>
  deviceTimeTrustWarn: boolean
  basisUnreachable: boolean
  directory: Record<string, ContactMeshEntryClient>
  loadMessages: ReturnType<typeof import('@/frontend/hooks/use-chat-view-inbox').useChatViewInbox>['loadMessages']
  setMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void
  appendMeshMessage: AppendMeshMessageFn
  appendMeshMessageWithInboundCapture: AppendMeshMessageFn
  onDelayMirrorPlaintext: (body: string, fromAddress: string) => void | Promise<void>
  refreshOfflineMailboxQueueCount: () => void
  clearMeshInboundText: () => void
  drainMeshInboundText: () => string[]
  selectInboxPartnerForSend: (address: string) => void
}

export function useChatViewSendOrchestration(p: UseChatViewSendOrchestrationParams) {
  const {
    channelMode,
    role,
    myAddress,
    isPrivate,
    isGroup,
    activeGroup,
    message,
    setMessage,
    recipient,
    setRecipient,
    partner,
    encrypted,
    forcedTransport,
    messagingPersistenceMode,
    composerMailboxObjectId,
    sending,
    setSending,
    setStatus,
    setStatusMsg,
    showSetup,
    setShowSetup,
    meshLoRaImagesEnabled,
    meshSelfArchiveAfterLoRa,
    meshtasticChannelIndex,
    morgPkgDeviceBusy,
    setMorgPkgDeviceBusy,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    setLoraMeshProgressLine,
    sosVoiceAwaitingSend,
    setSosVoiceAwaitingSend,
    clearSosVoicePrompt,
    apiStatus,
    refreshApiStatus,
    deviceTimeTrustWarn,
    directory,
    loadMessages,
    setMessages,
    appendMeshMessage,
    appendMeshMessageWithInboundCapture,
    onDelayMirrorPlaintext,
    refreshOfflineMailboxQueueCount,
    clearMeshInboundText,
    drainMeshInboundText,
    selectInboxPartnerForSend,
    basisUnreachable,
  } = p

  const sendSosAckBurstRef = useRef<((wire: string) => Promise<void>) | null>(null)

  const decryptMeshWire = useCallback(async (senderAddress: string, fullWire: Uint8Array) => {
    const { uint8ArrayToBase64 } = await import('@/frontend/lib/emergency-binary-browser')
    const r = await meshDecryptV2Wire(senderAddress, uint8ArrayToBase64(fullWire))
    return r.ok && r.text ? r.text : null
  }, [])

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
    setAttachedBlobBase64,
    setAttachedTxtFile,
    setAttachedAudioBase64,
    setCompactMeta,
    handleCompactAttachmentPick,
    ingestChatAttachmentFile,
  } = useChatViewAttachments({
    role,
    isPrivate,
    encrypted,
    forcedTransport,
    meshLoRaImagesEnabled,
    setStatus,
    setStatusMsg,
    onCompactIngestStart: clearSosVoicePrompt,
  })

  const clearCompactAttachmentAndSos = useCallback(() => {
    clearCompactAttachment()
    setSosVoiceAwaitingSend(false)
  }, [clearCompactAttachment, setSosVoiceAwaitingSend])

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
    morgPkgImports,
    morgPkgImportsOpen,
    setMorgPkgImportsOpen,
    removeMorgPkgImport,
    morgPkgExportRecipient,
    setMorgPkgExportRecipient,
    morgPkgExportPartnerOptions,
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
    meshLoRaImagesEnabled,
    meshSelfArchiveAfterLoRa,
    setMeshProgress: setLoraMeshProgressLine,
    onOfflineMailboxQueueChanged: refreshOfflineMailboxQueueCount,
    deviceTimeTrustWarn,
    meshPlaintextToNodeEnabled,
    meshPlaintextNodeId,
    meshtasticChannelIndex,
    clearMeshInboundText,
    drainMeshInboundText,
    contactDirectory: directory,
    activeGroup,
    isGroupChannel: isGroup,
    isPinnwandChannel: isPinnwandChannel(channelMode),
    composerMailboxObjectId,
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
    backendReachable: !basisUnreachable,
    refreshApiStatus,
    setSending,
    setStatus,
    setStatusMsg,
    setShowSetup,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
  })

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

  const onForwardMorgPkgItem = useCallback(
    (sender: string, item: MorgPkgImportItem) => {
      const r = applyMorgPkgItemToComposer(item, {
        clearAttachments: clearCompactAttachmentAndSos,
        setMessage,
        setAttachedBlobBase64,
        setAttachedTxtFile,
        setAttachedAudioBase64,
        setAttachedLora: () => {},
        setCompactMeta,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      const from = sender.trim().toLowerCase()
      if (/^0x[a-f0-9]{64}$/i.test(from)) {
        setRecipient(from)
        selectInboxPartnerForSend(from)
      }
      setMorgPkgImportsOpen(false)
      setStatus('success')
      const kindLabel =
        r.kind === 'image' ? 'Bild' : r.kind === 'audio' ? 'Audio' : r.kind === 'text_file' ? 'Textdatei' : 'Text'
      setStatusMsg(`${kindLabel} im Composer — Empfänger prüfen und senden.`)
      toast.success(`Weiterleiten: ${kindLabel} als Anhang — Empfänger prüfen.`)
      requestAnimationFrame(() => {
        document.getElementById('chat-composer-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    },
    [
      clearCompactAttachmentAndSos,
      setMessage,
      setAttachedBlobBase64,
      setAttachedTxtFile,
      setAttachedAudioBase64,
      setCompactMeta,
      setRecipient,
      selectInboxPartnerForSend,
      setMorgPkgImportsOpen,
      setStatus,
      setStatusMsg,
    ]
  )

  return {
    meshtastic,
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
    morgPkgImports,
    morgPkgImportsOpen,
    setMorgPkgImportsOpen,
    removeMorgPkgImport,
    onForwardMorgPkgItem,
    morgPkgExportRecipient,
    setMorgPkgExportRecipient,
    morgPkgExportPartnerOptions,
    confirmLoraSendViaOnline,
    handleSend,
    cancelSend,
    handleHandshake,
    handleHandshakeForAddress,
    handleConnectAcceptPartner,
    handleConnectAcceptForAddress,
    handleConnectDeployment,
    dismissLoraOnlineFallback,
    toggleShowSetup,
    openPartnerSetupPanel,
    onForwardMessage,
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

export type ChatViewSendOrchestration = ReturnType<typeof useChatViewSendOrchestration>
