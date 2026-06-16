'use client'

import { useCallback, useMemo, type ChangeEvent, type RefObject } from 'react'
import type { ChatViewSendPanelProps } from '@/frontend/components/chat-view-send-panel'
import type { ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import {
  asComposerDraft,
  asSendMeshFunkOptions,
  asSendTransportRead,
  asVoiceRecordSendPanel,
} from '@/frontend/features/messenger-ports'
import { buildGroupSendPanelContext } from '@/frontend/features/send/chat-view-group-send-context'
import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'
import { useChatViewTelegramComposer } from '@/frontend/hooks/use-chat-view-telegram-composer'
import { useEncryptedRecipientHandshakeStatus } from '@/frontend/hooks/use-encrypted-recipient-handshake-status'
import type {
  OutgoingHandshakeOffer,
  PendingHandshakeOffer,
} from '@/frontend/lib/handshake-offers-types'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { resolveComposerIotaAddress } from '@/frontend/lib/composer-recipient-fields'
import { isValidRecipient0x } from '@/frontend/lib/encrypted-recipient-handshake-status'
import { isPinnwandChannel, type MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import { recordTelegramOutgoing } from '@/frontend/lib/record-telegram-outgoing'
import type { AppendMeshMessageFn } from '@/frontend/hooks/use-chat-view-send-flow-types'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'

export type ChatViewSendPanelPropsDeps = {
  message: string
  setMessage: (v: string) => void
  recipient: string
  setRecipient: (v: string) => void
  partner: string
  setPartner: (v: string) => void
  encrypted: boolean
  forcedTransport: ForcedTransport
  meshLoRaImagesEnabled: boolean
  setMeshLoRaImagesEnabled: (v: boolean) => void
  meshSelfArchiveAfterLoRa: boolean
  setMeshSelfArchiveAfterLoRa: (v: boolean) => void
  isPrivate: boolean
  isGroup: boolean
  activeGroup: MessengerGroupDefinition | null
  sending: boolean
  loraOnlineFallbackOffer: { reasonLabel: string } | null
  confirmLoraSendViaOnline: () => void | Promise<void>
  dismissLoraOnlineFallback: () => void
  apiStatus: ApiStatus | null
  handleSend: (opts?: ChatSendHandleOptions) => void | Promise<void>
  cancelSend?: () => void
  status: 'idle' | 'success' | 'error'
  statusMsg: string
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  offlineMailboxQueuePending: number
  offlineMailboxQueueUntrustedTimeCount: number
  offlineMailboxQueueBackoffCount: number
  offlineMailboxQueueErrorHint?: string
  offlineMailboxQueueItems: ChatViewSendPanelProps['offlineMailboxQueueItems']
  removeOfflineMailboxQueueItems: (ids: string[]) => void
  meshPlaintextToNodeEnabled: boolean
  setMeshPlaintextToNodeEnabled: (v: boolean) => void
  meshPlaintextNodeId: string
  setMeshPlaintextNodeId: (v: string) => void
  meshtasticChannelIndex?: number
  setMeshtasticChannelIndex: (v: number | undefined) => void
  voicePhase: ChatViewSendPanelProps['voicePhase']
  voiceActiveKind: ChatViewSendPanelProps['voiceActiveKind']
  voiceProgress01: number
  voiceMaxSeconds: number
  voiceEmergencyMaxSeconds: number
  sosVoiceFollowsOnline: boolean
  onVoiceToggle: () => void
  onVoiceEmergencyToggle: () => void
  voiceNormalBlockedStart: boolean
  voiceEmergencyBlockedStart: boolean
  voiceBusy: boolean
  voiceRecording: boolean
  sosVoiceAwaitingSend: boolean
  compactFileRef: RefObject<HTMLInputElement | null>
  compactBusy: boolean
  attachmentPipelineHint: string | null
  handleCompactAttachmentPick: (e: ChangeEvent<HTMLInputElement>) => void
  ingestChatAttachmentFile: (file: File, opts?: { transportOverride?: ForcedTransport }) => Promise<void>
  compactMeta: ChatViewSendPanelProps['compactMeta']
  attachedBlobBase64: string | null
  attachedLora: ChatAttachedLora | null
  attachedTxtFile: { name: string; text: string } | null
  attachedAudioBase64: string | null
  clearCompactAttachment: () => void
  compactPreviewUrl: string | null
  loraPreviewUrl: string | null
  loraMeshProgressLine: string | null
  refreshApiStatus?: () => void | Promise<void>
  loadMessages: (
    mode?: 'reset' | 'append' | 'poll',
    overridePackageId?: unknown,
    opts?: { silent?: boolean }
  ) => void | Promise<void>
  directory: Record<string, ContactMeshEntryClient>
  myAddress: string
  composerDelivery: ComposerDeliveryChannel
  messagingPersistenceMode: MessagingPersistenceMode
  composerMailboxObjectId?: string
  setComposerMailboxObjectId: (id: string) => void
  appendMeshMessage: AppendMeshMessageFn
  handleHandshakeForAddress: (addr: string) => void | Promise<void>
  handleConnectAcceptForAddress: (addr: string) => void | Promise<void>
  expertTools: boolean
  pinnwandBroadcastAddress?: string
  canPostToPinnwand: boolean
  channelMode?: MessengerChatChannel
  vaultBannerActions?: ChatViewVaultBannerActions
  onOpenPhonebook?: () => void
  handshakeConnectedAddresses: string[]
  pendingHandshakeOffers: PendingHandshakeOffer[]
  outgoingHandshakeOffers: OutgoingHandshakeOffer[]
  reloadPendingHandshakes: () => void
}

export function useChatViewSendPanelProps(deps: ChatViewSendPanelPropsDeps): {
  sendPanelProps: ChatViewSendPanelProps
  syncPartnerAndRecipient: (v: string) => void
} {
  const groupSendPanelContext = useMemo(
    () =>
      buildGroupSendPanelContext({
        isGroupChannel: deps.isGroup,
        activeGroup: deps.activeGroup,
        myAddress: deps.myAddress,
      }),
    [deps.isGroup, deps.activeGroup, deps.myAddress]
  )

  const composerEncryptedRecipient = useMemo(
    () => resolveComposerIotaAddress(deps.recipient, deps.partner, deps.encrypted),
    [deps.recipient, deps.partner, deps.encrypted]
  )

  const encryptedRecipientHandshake = useEncryptedRecipientHandshakeStatus({
    enabled:
      deps.isPrivate &&
      deps.encrypted &&
      deps.forcedTransport === 'internet' &&
      deps.composerDelivery === 'chain' &&
      isValidRecipient0x(composerEncryptedRecipient),
    recipient: composerEncryptedRecipient,
    connectedAddresses: deps.handshakeConnectedAddresses,
    incomingOffers: deps.pendingHandshakeOffers,
    outgoingOffers: deps.outgoingHandshakeOffers,
  })

  const handleEncryptedHandshakeForComposerRecipient = useCallback(async () => {
    const addr = composerEncryptedRecipient.trim().toLowerCase()
    if (!isValidRecipient0x(addr)) return
    deps.setPartner(addr)
    await deps.handleHandshakeForAddress(addr)
    encryptedRecipientHandshake.refresh()
    window.setTimeout(() => void deps.reloadPendingHandshakes(), 3000)
  }, [
    composerEncryptedRecipient,
    deps.setPartner,
    deps.handleHandshakeForAddress,
    encryptedRecipientHandshake,
    deps.reloadPendingHandshakes,
  ])

  const handleEncryptedAcceptForComposerRecipient = useCallback(async () => {
    const addr = composerEncryptedRecipient.trim().toLowerCase()
    if (!isValidRecipient0x(addr)) return
    deps.setPartner(addr)
    await deps.handleConnectAcceptForAddress(addr)
    encryptedRecipientHandshake.refresh()
    await deps.refreshApiStatus?.()
    window.setTimeout(() => void deps.reloadPendingHandshakes(), 4000)
  }, [
    composerEncryptedRecipient,
    deps.setPartner,
    deps.handleConnectAcceptForAddress,
    encryptedRecipientHandshake,
    deps.refreshApiStatus,
    deps.reloadPendingHandshakes,
  ])

  const telegramComposer = useChatViewTelegramComposer({
    isPrivate: deps.isPrivate,
    composerDelivery: deps.composerDelivery,
    recipient: deps.recipient,
    partner: deps.partner,
    encrypted: deps.encrypted,
    message: deps.message,
    apiStatus: deps.apiStatus,
    contactDirectory: deps.directory,
    myAddress: deps.myAddress,
    sending: deps.sending,
    attachedTxtFile: deps.attachedTxtFile,
    attachedBlobBase64: deps.attachedBlobBase64,
    attachedAudioBase64: deps.attachedAudioBase64,
    hasLoraAttachment: deps.attachedLora != null,
    onMessageChange: deps.setMessage,
    clearAttachments: deps.clearCompactAttachment,
    onStatusFeedback: (msg, st = 'success') => {
      deps.setStatus(st)
      deps.setStatusMsg(msg)
    },
    onTelegramDelivered: ({ recipientKey, text }) => {
      recordTelegramOutgoing(deps.appendMeshMessage, deps.myAddress, recipientKey, text)
    },
  })

  const syncPartnerAndRecipient = useCallback(
    (v: string) => {
      const t = v.trim().toLowerCase()
      deps.setPartner(t)
      if (deps.isPrivate) deps.setRecipient(t)
    },
    [deps.isPrivate, deps.setPartner, deps.setRecipient]
  )

  const sendPanelProps = {
    ...asComposerDraft(deps.message, deps.recipient, deps.setMessage, deps.setRecipient),
    ...asSendTransportRead(deps.encrypted, deps.forcedTransport),
    ...asSendMeshFunkOptions(
      deps.meshLoRaImagesEnabled,
      deps.setMeshLoRaImagesEnabled,
      deps.meshSelfArchiveAfterLoRa,
      deps.setMeshSelfArchiveAfterLoRa
    ),
    isPrivate: deps.isPrivate,
    sending: deps.sending,
    loraOnlineFallbackOffer: deps.loraOnlineFallbackOffer,
    onConfirmLoraOnline: deps.confirmLoraSendViaOnline,
    onDismissLoraOnlineFallback: deps.dismissLoraOnlineFallback,
    apiStatus: deps.apiStatus,
    onSend: deps.handleSend,
    onCancelSend: deps.cancelSend,
    status: deps.status,
    statusMsg: deps.statusMsg,
    offlineMailboxQueuePending: deps.offlineMailboxQueuePending,
    offlineMailboxQueueUntrustedTimeCount: deps.offlineMailboxQueueUntrustedTimeCount,
    offlineMailboxQueueBackoffCount: deps.offlineMailboxQueueBackoffCount,
    offlineMailboxQueueErrorHint: deps.offlineMailboxQueueErrorHint,
    offlineMailboxQueueItems: deps.offlineMailboxQueueItems,
    onRemoveOfflineMailboxQueueItems: deps.removeOfflineMailboxQueueItems,
    meshPlaintextToNodeEnabled: deps.meshPlaintextToNodeEnabled,
    onMeshPlaintextToNodeEnabledChange: deps.setMeshPlaintextToNodeEnabled,
    meshPlaintextNodeId: deps.meshPlaintextNodeId,
    onMeshPlaintextNodeIdChange: deps.setMeshPlaintextNodeId,
    meshtasticChannelIndex: deps.meshtasticChannelIndex,
    onMeshtasticChannelIndexChange: deps.setMeshtasticChannelIndex,
    showMeshtasticChannelIndexInput: deps.expertTools,
    ...asVoiceRecordSendPanel(
      {
        voicePhase: deps.voicePhase,
        voiceActiveKind: deps.voiceActiveKind,
        voiceProgress01: deps.voiceProgress01,
        voiceMaxSeconds: deps.voiceMaxSeconds,
        voiceEmergencyMaxSeconds: deps.voiceEmergencyMaxSeconds,
        sosVoiceFollowsOnline: deps.sosVoiceFollowsOnline,
        onVoiceToggle: deps.onVoiceToggle,
        onVoiceEmergencyToggle: deps.onVoiceEmergencyToggle,
        voiceNormalBlockedStart: deps.voiceNormalBlockedStart,
        voiceEmergencyBlockedStart: deps.voiceEmergencyBlockedStart,
        voiceBusy: deps.voiceBusy,
        voiceRecording: deps.voiceRecording,
      },
      deps.sosVoiceAwaitingSend
    ),
    forcedTransport: deps.forcedTransport,
    compactFileRef: deps.compactFileRef,
    compactBusy: deps.compactBusy,
    attachmentPipelineHint: deps.attachmentPipelineHint,
    onFileChange: deps.handleCompactAttachmentPick,
    ingestChatAttachmentFile: deps.ingestChatAttachmentFile,
    compactMeta: deps.compactMeta,
    attachedBlobBase64: deps.attachedBlobBase64,
    attachedLora: deps.attachedLora,
    attachedTxtFile: deps.attachedTxtFile,
    attachedAudioBase64: deps.attachedAudioBase64,
    clearCompactAttachment: deps.clearCompactAttachment,
    compactPreviewUrl: deps.compactPreviewUrl,
    loraPreviewUrl: deps.loraPreviewUrl,
    loraMeshProgressLine: deps.loraMeshProgressLine,
    onManualRefresh: async () => {
      await deps.refreshApiStatus?.()
      await deps.loadMessages('reset')
    },
    contactDirectory: deps.directory,
    isGroupChannel: deps.isGroup,
    groupMailboxSendAll: groupSendPanelContext.groupMailboxSendAll,
    groupMemberCount: groupSendPanelContext.groupMemberCount,
    groupTeamBroadcastReady: groupSendPanelContext.groupTeamBroadcastReady,
    partner: deps.partner,
    onPartnerChange: syncPartnerAndRecipient,
    myAddress: deps.myAddress,
    hideComposerIotaRecipient:
      deps.isPrivate &&
      deps.encrypted &&
      deps.forcedTransport === 'internet' &&
      deps.composerDelivery === 'chain',
    onStatusFeedback: (msg, st = 'success') => {
      deps.setStatus(st)
      deps.setStatusMsg(msg)
    },
    composerDelivery: deps.composerDelivery,
    messagingPersistenceMode: deps.messagingPersistenceMode,
    onTelegramSend: telegramComposer.handleTelegramOnly,
    canSendTelegram: telegramComposer.canSendTelegramOnly,
    telegramBusy: telegramComposer.telegramOnlyBusy,
    onNavigateHomeWhenLocked: deps.vaultBannerActions?.onNavigateHomeWhenLocked,
    composerMailboxObjectId: deps.composerMailboxObjectId,
    onComposerMailboxObjectIdChange: deps.setComposerMailboxObjectId,
    encryptedRecipientHandshakeStatus: encryptedRecipientHandshake.status,
    encryptedHandshakeBlocksSend: encryptedRecipientHandshake.blocksSend,
    onEncryptedHandshakeForRecipient: handleEncryptedHandshakeForComposerRecipient,
    onEncryptedAcceptHandshakeForRecipient: handleEncryptedAcceptForComposerRecipient,
    showPath4Checkbox: deps.expertTools,
    onOpenPhonebook: deps.onOpenPhonebook,
    isPinnwandChannel: deps.channelMode != null && isPinnwandChannel(deps.channelMode),
    pinnwandBroadcastAddress: deps.pinnwandBroadcastAddress,
    canPostToPinnwand: deps.canPostToPinnwand,
  } satisfies ChatViewSendPanelProps

  return { sendPanelProps, syncPartnerAndRecipient }
}
