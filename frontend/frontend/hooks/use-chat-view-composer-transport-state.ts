'use client'

/**
 * Composer- und Transport-State (Nachricht, Empfänger, Verschlüsselung, Sendepfad, Funk-Optionen).
 * Aus use-chat-view-core extrahiert (P1 Port-Assembler-Scheibe).
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  type MessagingPersistenceMode,
  writeMessagingPersistenceModeToStorage,
} from '@/frontend/lib/messaging-persistence-mode'
import { inferMessagingPersistenceModeFromComposer } from '@/frontend/lib/infer-composer-persistence-mode'
import { buildGroupSendPanelContext } from '@/frontend/features/send/chat-view-group-send-context'
import {
  readComposerMailboxObjectId,
  writeComposerMailboxObjectId,
} from '@/frontend/lib/composer-mailbox-object-id'
import { resolveComposerIotaAddress } from '@/frontend/lib/composer-recipient-fields'
import {
  MESH_LORA_IMAGES_LS,
  MESH_SELF_ARCHIVE_PATH4_LS,
  readMeshLoRaImagesEnabledFromStorage,
  readMeshSelfArchiveAfterLoRaFromStorage,
} from '@/frontend/lib/mesh-lora-composer-options'
import { normalizeMeshtasticChannelIndex } from '@/frontend/lib/meshtastic-channel-index'
import { reconcileChannelSendPath } from '@/frontend/lib/messenger-channel-send-path'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import { isDialogChannel } from '@/frontend/lib/messenger-chat-channel'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'

export type UseChatViewComposerTransportStateParams = {
  channelMode: MessengerChatChannel
  isGroup: boolean
  activeGroup: MessengerGroupDefinition | null
  myAddress: string
  directory: Record<string, ContactMeshEntryClient>
}

export function useChatViewComposerTransportState(p: UseChatViewComposerTransportStateParams) {
  const { channelMode, isGroup, activeGroup, myAddress, directory } = p
  const isPrivate = isDialogChannel(channelMode)

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

  const meshFirstTransportDefaultApplied = useRef(false)

  useEffect(() => {
    if (!isPrivate) setEncryptedInternal(false)
  }, [isPrivate])

  useEffect(() => {
    const r = reconcileChannelSendPath(channelMode, composerDelivery, forcedTransport)
    if (r.composerDelivery !== composerDelivery) setComposerDelivery(r.composerDelivery)
    if (r.forcedTransport !== forcedTransport) setForcedTransportInternal(r.forcedTransport)
  }, [channelMode, composerDelivery, forcedTransport])

  useEffect(() => {
    if (!encrypted) setShowSetup(false)
  }, [encrypted])

  useEffect(() => {
    if (composerDelivery !== 'telegram') return
    setShowSetup(false)
    if (forcedTransport === 'mesh' || forcedTransport === 'adhoc') {
      setForcedTransportInternal('internet')
    }
  }, [composerDelivery, forcedTransport])

  const [sosVoiceAwaitingSend, setSosVoiceAwaitingSend] = useState(false)
  const clearSosVoicePrompt = useCallback(() => setSosVoiceAwaitingSend(false), [])
  const [morgPkgDeviceBusy, setMorgPkgDeviceBusy] = useState(false)
  const morgPkgFileRef = useRef<HTMLInputElement>(null)
  const morgPkgDeviceFilesRef = useRef<HTMLInputElement>(null)

  const [meshLoRaImagesEnabled, setMeshLoRaImagesEnabledState] = useState(() =>
    readMeshLoRaImagesEnabledFromStorage()
  )
  const setMeshLoRaImagesEnabled = useCallback((v: boolean) => {
    setMeshLoRaImagesEnabledState(v)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(MESH_LORA_IMAGES_LS, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const [meshSelfArchiveAfterLoRa, setMeshSelfArchiveAfterLoRaState] = useState(() =>
    readMeshSelfArchiveAfterLoRaFromStorage()
  )
  const setMeshSelfArchiveAfterLoRa = useCallback((v: boolean) => {
    setMeshSelfArchiveAfterLoRaState(v)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(MESH_SELF_ARCHIVE_PATH4_LS, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const [composerMailboxObjectId, setComposerMailboxObjectIdState] = useState('')

  const setComposerMailboxObjectId = useCallback(
    (id: string) => {
      const normalized = id.trim().toLowerCase()
      setComposerMailboxObjectIdState(normalized)
      const addr = resolveComposerIotaAddress(recipient, partner, encrypted).trim().toLowerCase()
      if (/^0x[a-f0-9]{64}$/i.test(addr)) writeComposerMailboxObjectId(addr, normalized)
    },
    [recipient, partner, encrypted]
  )

  const groupSendPanelContext = useMemo(
    () =>
      buildGroupSendPanelContext({
        isGroupChannel: isGroup,
        activeGroup,
        myAddress,
      }),
    [isGroup, activeGroup, myAddress]
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
        contactDirectory: directory,
        isGroupChannel: isGroup,
        groupMailboxSendAll: groupSendPanelContext.groupMailboxSendAll,
      }),
    [
      recipient,
      partner,
      encrypted,
      forcedTransport,
      composerDelivery,
      composerMailboxObjectId,
      directory,
      isGroup,
      groupSendPanelContext.groupMailboxSendAll,
    ]
  )

  useEffect(() => {
    writeMessagingPersistenceModeToStorage(messagingPersistenceMode)
  }, [messagingPersistenceMode])

  const setMessagingPersistenceMode = useCallback((_m: MessagingPersistenceMode) => {
    /* noop — Persistenz kommt aus Empfänger + Postfach-Auswahl */
  }, [])

  const [loraMeshProgressLine, setLoraMeshProgressLine] = useState<string | null>(null)

  return {
    isPrivate,
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
    encrypted,
    setEncrypted,
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
    setComposerMailboxObjectIdState,
    meshLoRaImagesEnabled,
    setMeshLoRaImagesEnabled,
    meshSelfArchiveAfterLoRa,
    setMeshSelfArchiveAfterLoRa,
    sosVoiceAwaitingSend,
    setSosVoiceAwaitingSend,
    clearSosVoicePrompt,
    morgPkgDeviceBusy,
    setMorgPkgDeviceBusy,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    loraMeshProgressLine,
    setLoraMeshProgressLine,
    meshFirstTransportDefaultApplied,
    groupSendPanelContext,
  }
}

export type ChatViewComposerTransportState = ReturnType<typeof useChatViewComposerTransportState>
