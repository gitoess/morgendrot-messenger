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
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
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
  type MessagingPersistenceMode,
  writeMessagingPersistenceModeToStorage,
} from '@/frontend/lib/messaging-persistence-mode'
import { inferMessagingPersistenceModeFromComposer } from '@/frontend/lib/infer-composer-persistence-mode'
import { readGroupMailboxSendAll } from '@/frontend/lib/group-mailbox-pairwise-send'
import {
  readComposerMailboxObjectId,
  writeComposerMailboxObjectId,
} from '@/frontend/lib/composer-mailbox-object-id'
import { resolveComposerIotaAddress } from '@/frontend/lib/composer-recipient-fields'
import { buildForwardComposerPayload } from '@/frontend/lib/chat-forward-text'
import { applyMorgPkgItemToComposer } from '@/frontend/lib/apply-morg-pkg-item-to-composer'
import type { MorgPkgImportItem } from '@/frontend/lib/morg-pkg-import-store'
import { toast } from 'sonner'
import {
  getActiveMessengerGroup,
  type MessengerGroupDefinition,
} from '@/frontend/lib/messenger-group-store'
import { resolveGroupTeamMailboxObjectId } from '@/frontend/lib/group-team-broadcast'
import {
  isDialogChannel,
  isGroupChannel,
  isPinnwandChannel,
  type MessengerChatChannel,
} from '@/frontend/lib/messenger-chat-channel'
import { reconcileChannelSendPath } from '@/frontend/lib/messenger-channel-send-path'
import { normalizeMeshtasticChannelIndex } from '@/frontend/lib/meshtastic-channel-index'
import { isSimpleUiMode } from '@/frontend/lib/messenger-role-capabilities'
import {
  isMessengerHelperRole,
  showPinnwandInboxStrip,
  buildPinnwandMatchContext,
} from '@/frontend/lib/messenger-pinnwand-capabilities'

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
  const groupTeamMailboxId = useMemo(
    () => resolveGroupTeamMailboxObjectId(activeGroup),
    [activeGroup]
  )
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
  const [composerDelivery, setComposerDelivery] = useState<ComposerDeliveryChannel>('chain')
  const [meshtasticChannelIndex, setMeshtasticChannelIndexState] = useState<number | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    try {
      return normalizeMeshtasticChannelIndex(window.localStorage.getItem('morgendrot.meshChannelIndex'))
    } catch {
      return undefined
    }
  })

  const setMeshtasticChannelIndex = useCallback((v: number | undefined) => {
    const normalized = normalizeMeshtasticChannelIndex(v)
    setMeshtasticChannelIndexState(normalized)
    if (typeof window === 'undefined') return
    try {
      if (normalized == null) window.localStorage.removeItem('morgendrot.meshChannelIndex')
      else window.localStorage.setItem('morgendrot.meshChannelIndex', String(normalized))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!isGroup || !activeGroup) return
    const groupChannelIndex = normalizeMeshtasticChannelIndex(activeGroup.secondaryChannel?.channelIndex)
    if (groupChannelIndex == null) return
    setMeshtasticChannelIndexState((prev) => (prev == null ? groupChannelIndex : prev))
  }, [isGroup, activeGroup])

  /** Verschlüsselter Funk (Mesh v2 / PRIVATE_APP) ist produktseitig abgeschaltet — Funk = Klartext; Verschlüsselung nur Online/IOTA. */
  const setForcedTransport = useCallback((t: ForcedTransport) => {
    setComposerDelivery('chain')
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

  /** Einmal: bei `TRANSPORT_PROFILE=mesh-first` Default-Sendeweg „funk“ (§ TRANSPORT-AND-IOTA-LAYERS). */
  const meshFirstTransportDefaultApplied = useRef(false)

  /** Pinnwand: kein E2EE — Klartext konsistent setzen (Gruppe: Umschalter im Gruppenpanel). */
  useEffect(() => {
    if (!isPrivate) setEncryptedInternal(false)
  }, [isPrivate])

  useEffect(() => {
    const r = reconcileChannelSendPath(channelMode, composerDelivery, forcedTransport)
    if (r.channel !== channelMode) {
      /* channel correction happens in ChatView via onChannelModeChange — skip here */
    }
    if (r.composerDelivery !== composerDelivery) setComposerDelivery(r.composerDelivery)
    if (r.forcedTransport !== forcedTransport) setForcedTransportInternal(r.forcedTransport)
  }, [channelMode, composerDelivery, forcedTransport])

  useEffect(() => {
    if (!encrypted) setShowSetup(false)
  }, [encrypted])

  /** Telegram: kein Heltec/Setup — Transport zurück auf online. */
  useEffect(() => {
    if (composerDelivery !== 'telegram') return
    setShowSetup(false)
    if (forcedTransport === 'mesh' || forcedTransport === 'adhoc') {
      setForcedTransportInternal('internet')
    }
  }, [composerDelivery, forcedTransport])

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
    inboxFromCache,
    inboxCacheAgeMinutes,
    inboxLiveSource,
    loadMessages,
    loadMoreInbox,
    inboxHasMore,
    appendMeshMessage,
    clearInboxRam,
  } = useChatViewInbox({
    refreshContactDirectory,
    /** Kein UI-Filter: Backend lädt Union (aktuell + package-id-history). Temporär nur via loadMessages-Override. */
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

  const [composerMailboxObjectId, setComposerMailboxObjectIdState] = useState('')

  useEffect(() => {
    const addr = resolveComposerIotaAddress(recipient, partner, encrypted).trim().toLowerCase()
    if (/^0x[a-f0-9]{64}$/i.test(addr)) {
      setComposerMailboxObjectIdState(readComposerMailboxObjectId(addr))
    } else {
      setComposerMailboxObjectIdState('')
    }
  }, [recipient, partner, encrypted])

  const setComposerMailboxObjectId = useCallback(
    (id: string) => {
      const normalized = id.trim().toLowerCase()
      setComposerMailboxObjectIdState(normalized)
      const addr = resolveComposerIotaAddress(recipient, partner, encrypted).trim().toLowerCase()
      if (/^0x[a-f0-9]{64}$/i.test(addr)) writeComposerMailboxObjectId(addr, normalized)
    },
    [recipient, partner, encrypted]
  )

  const messagingPersistenceMode = useMemo(
    () =>
      inferMessagingPersistenceModeFromComposer({
        recipient,
        partner,
        encrypted,
        forcedTransport,
        deliveryChannel: composerDelivery,
        composerMailboxObjectId,
        isGroupChannel: isGroup,
        groupMailboxSendAll: isGroup && readGroupMailboxSendAll(),
      }),
    [
      recipient,
      partner,
      encrypted,
      forcedTransport,
      composerDelivery,
      composerMailboxObjectId,
      isGroup,
    ]
  )

  useEffect(() => {
    writeMessagingPersistenceModeToStorage(messagingPersistenceMode)
  }, [messagingPersistenceMode])

  /** Persistenz kommt aus Empfänger + Postfach-Auswahl — kein globaler Umschalter mehr. */
  const setMessagingPersistenceMode = useCallback((_m: MessagingPersistenceMode) => {
    /* noop */
  }, [])

  /** Optional: Fortschrittszeile für die Anhang-Leiste beim LoRa-Bild (z. B. SOS-/Retry-Text). */
  const [loraMeshProgressLine, setLoraMeshProgressLine] = useState<string | null>(null)

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
  const { apiStatus, refreshApiStatus, basisUnreachable, packageIdMismatch, deviceTimeTrustWarn, statusCacheAgeMinutes } =
    useChatViewApiStatusPoll({
      runMirrorDrain,
      runOfflineMailboxDrain,
      pollInbox: () => loadMessages('poll', undefined, { silent: true }),
      onReconnectNow: () => {
        void loadMessages('poll', undefined, { silent: true })
        refreshContactDirectory()
        void runOfflineMailboxDrain()
      },
      localPackageId: inboxPackageFilter.trim(),
      probeGeolocationForDeviceTime: isPrivate,
    })

  const inboxOverviewEnabled = useMemo(() => {
    return isSimpleUiMode(apiStatus) || isMessengerHelperRole(role)
  }, [apiStatus, role])

  const excludePinnwandFromOverviewAlle = useMemo(
    () => showPinnwandInboxStrip(apiStatus, role, channelMode),
    [apiStatus, role, channelMode]
  )

  const pinnwandMatchContext = useMemo(
    () => buildPinnwandMatchContext(apiStatus, myAddress),
    [apiStatus, myAddress]
  )

  const {
    protokollMarkedIds,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    displayMessages,
    filteredDisplayMessages,
    pinnwandFeedMessages,
    inboxPartnerKey,
    setInboxPartnerKey,
    inboxDirectionFilter,
    setInboxDirectionFilter,
    inboxSourceFilter,
    setInboxSourceFilter,
    inboxChannelFiltersArmed,
    setInboxChannelFiltersArmed,
    inboxWireFiltersArmed,
    setInboxWireFiltersArmed,
    inboxPartnerFiltersArmed,
    setInboxPartnerFiltersArmed,
    inboxWireFilter,
    setInboxWireFilter,
    inboxPartnerOptions,
    inboxUnreadThreadOptions,
    isInboxMessageUnread,
    isPinnwandInboxMessage,
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
    inboxOverviewEnabled: inboxOverviewChipsVisible,
    inboxOverviewCategory,
    setInboxOverviewCategory,
    inboxOverviewUnreadCounts,
  } = useChatViewInboxLocalUi({
    messages,
    setMessages,
    loadMessages,
    setSending,
    setStatus,
    setStatusMsg,
    myAddress,
    contactDirectory: directory,
    teamMailboxObjectId: groupTeamMailboxId,
    pinnwandMatchContext,
    inboxOverviewEnabled,
    excludePinnwandFromOverviewAlle,
    apiStatus,
  })

  useEffect(() => {
    if (!isPinnwandChannel(channelMode)) return
    setInboxOverviewCategory('lagebild')
  }, [channelMode, setInboxOverviewCategory])

  useEffect(() => {
    setInboxChannelFiltersArmed(false)
    setInboxWireFiltersArmed(false)
    setInboxPartnerFiltersArmed(false)
  }, [channelMode, setInboxChannelFiltersArmed, setInboxWireFiltersArmed, setInboxPartnerFiltersArmed])

  /** Package-Mismatch: View-Filter leeren und Backend-Union neu laden. */
  useEffect(() => {
    if (!packageIdMismatch) return
    setInboxPackageFilter('')
    void loadMessages('reset')
  }, [packageIdMismatch, setInboxPackageFilter, loadMessages])

  /** M3: Broadcast-Adresse aus /api/status — festes Empfängerfeld (Pinnwand-Kanal). */
  useEffect(() => {
    if (!isPinnwandChannel(channelMode)) return
    const addr = apiStatus?.broadcastPinnwand?.address?.trim().toLowerCase() ?? ''
    if (!addr || !/^0x[a-f0-9]{64}$/.test(addr)) return
    setRecipient(addr)
  }, [channelMode, apiStatus?.broadcastPinnwand?.address, setRecipient])

  useEffect(() => {
    if (meshFirstTransportDefaultApplied.current || !apiStatus?.transportProfile) return
    meshFirstTransportDefaultApplied.current = true
    if (apiStatus.transportProfile === 'mesh-first') {
      setForcedTransportInternal('mesh')
      setEncryptedInternal(false)
    }
  }, [apiStatus?.transportProfile])

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
    apiStatus,
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

  const pinnwandSlideSequences = useMemo(
    () => extractCompletedSlideSequences(pinnwandFeedMessages),
    [pinnwandFeedMessages]
  )

  const pinnwandInboxRows = useMemo(
    (): ChatInboxRow[] => buildChatInboxRows(pinnwandFeedMessages, pinnwandSlideSequences),
    [pinnwandFeedMessages, pinnwandSlideSequences]
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

  const {
    refreshPackageIdSuggestions,
    applyPackageIdBackend,
    applyInboxPackageFilterOnly,
  } = useChatViewPackageIdCommands({
    showSetup,
    loadPackageSuggestions: true,
    inboxPackageFilter,
    setInboxPackageFilter,
    setPackageIdSuggestions,
    setPackageIdBusy,
    loadMessages,
    refreshApiStatus,
    setStatus,
    setStatusMsg,
  })

  /** Package-Verlauf: Union aus /api/status + Historie-Datei. */
  useEffect(() => {
    const union = apiStatus?.inboxUnionPackageIds
    if (!union?.length) return
    void refreshPackageIdSuggestions(union)
  }, [apiStatus?.inboxUnionPackageIds, refreshPackageIdSuggestions])

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
    setSending,
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
    statusCacheAgeMinutes,
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
    composerDelivery,
    setComposerDelivery,
    meshtasticChannelIndex,
    setMeshtasticChannelIndex,
    messagingPersistenceMode,
    setMessagingPersistenceMode,
    composerMailboxObjectId,
    setComposerMailboxObjectId,
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
    inboxFromCache,
    inboxCacheAgeMinutes,
    inboxLiveSource,
    loadMessages,
    loadMoreInbox,
    inboxHasMore,
    appendMeshMessage,
    clearInboxRam,
    slideSequences,
    inboxRows,
    pinnwandFeedMessages,
    pinnwandInboxRows,
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
    inboxSourceFilter,
    setInboxSourceFilter,
    inboxChannelFiltersArmed,
    setInboxChannelFiltersArmed,
    inboxWireFiltersArmed,
    setInboxWireFiltersArmed,
    inboxPartnerFiltersArmed,
    setInboxPartnerFiltersArmed,
    inboxWireFilter,
    setInboxWireFilter,
    inboxPartnerOptions,
    inboxUnreadThreadOptions,
    isInboxMessageUnread,
    isPinnwandInboxMessage,
    selectInboxPartnerForSend,
    removeInboxPartnerFromQuickList,
    resetInboxViewFilters,
    inboxVisibilityHint,
    inboxOverviewChipsVisible,
    inboxOverviewCategory,
    setInboxOverviewCategory,
    inboxOverviewUnreadCounts,
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
