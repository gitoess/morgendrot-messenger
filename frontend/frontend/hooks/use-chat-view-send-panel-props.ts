'use client'

import { useCallback, useMemo } from 'react'
import type { ChatViewSendPanelProps } from '@/frontend/components/chat-view-send-panel'
import type { ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'
import { buildGroupSendPanelContext } from '@/frontend/features/send/chat-view-group-send-context'
import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'
import { useChatViewTelegramComposer } from '@/frontend/hooks/use-chat-view-telegram-composer'
import { useEncryptedRecipientHandshakeStatus } from '@/frontend/hooks/use-encrypted-recipient-handshake-status'
import type {
  OutgoingHandshakeOffer,
  PendingHandshakeOffer,
} from '@/frontend/lib/handshake-offers-types'
import { resolveComposerIotaAddress } from '@/frontend/lib/composer-recipient-fields'
import { isValidRecipient0x } from '@/frontend/lib/encrypted-recipient-handshake-status'
import { isPinnwandChannel } from '@/frontend/lib/messenger-chat-channel'
import { recordTelegramOutgoing } from '@/frontend/lib/record-telegram-outgoing'
import type { AppendMeshMessageFn } from '@/frontend/hooks/use-chat-view-send-flow-types'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'

export type ChatViewSendPanelPropsDeps = {
  messengerPorts: ChatViewMessengerPorts
  setPartner: (v: string) => void
  activeGroup: MessengerGroupDefinition | null
  loraOnlineFallbackOffer: { reasonLabel: string } | null
  confirmLoraSendViaOnline: () => void | Promise<void>
  dismissLoraOnlineFallback: () => void
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
  refreshApiStatus?: () => void | Promise<void>
  loadMessages: (
    mode?: 'reset' | 'append' | 'poll',
    overridePackageId?: unknown,
    opts?: { silent?: boolean }
  ) => void | Promise<void>
  composerMailboxObjectId?: string
  setComposerMailboxObjectId: (id: string) => void
  appendMeshMessage: AppendMeshMessageFn
  handleHandshakeForAddress: (addr: string) => void | Promise<void>
  handleConnectAcceptForAddress: (addr: string) => void | Promise<void>
  expertTools: boolean
  pinnwandBroadcastAddress?: string
  canPostToPinnwand: boolean
  vaultBannerActions?: ChatViewVaultBannerActions
  onOpenPhonebook?: () => void
  pendingHandshakeOffers: PendingHandshakeOffer[]
  outgoingHandshakeOffers: OutgoingHandshakeOffer[]
  reloadPendingHandshakes: () => void
}

export function useChatViewSendPanelProps(deps: ChatViewSendPanelPropsDeps): {
  sendPanelProps: ChatViewSendPanelProps
  syncPartnerAndRecipient: (v: string) => void
} {
  const {
    composerDraft,
    sendTransportRead,
    sendTransportChoice,
    inboxFeedRead,
    composerPartner,
    composerSendPath,
    attachmentBar,
    contactDirectoryRead,
    connectionStatusRead,
    meshSendOptions,
  } = deps.messengerPorts

  const groupSendPanelContext = useMemo(
    () =>
      buildGroupSendPanelContext({
        isGroupChannel: composerSendPath.isGroup,
        activeGroup: deps.activeGroup,
        myAddress: inboxFeedRead.myAddress,
      }),
    [composerSendPath.isGroup, deps.activeGroup, inboxFeedRead.myAddress]
  )

  const composerEncryptedRecipient = useMemo(
    () =>
      resolveComposerIotaAddress(
        composerDraft.recipient,
        composerPartner.partner,
        sendTransportRead.encrypted
      ),
    [composerDraft.recipient, composerPartner.partner, sendTransportRead.encrypted]
  )

  const encryptedRecipientHandshake = useEncryptedRecipientHandshakeStatus({
    enabled:
      composerSendPath.isPrivate &&
      sendTransportRead.encrypted &&
      sendTransportRead.forcedTransport === 'internet' &&
      composerSendPath.composerDelivery === 'chain' &&
      isValidRecipient0x(composerEncryptedRecipient),
    recipient: composerEncryptedRecipient,
    connectedAddresses: [...connectionStatusRead.connectedAddresses],
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
    isPrivate: composerSendPath.isPrivate,
    composerDelivery: composerSendPath.composerDelivery,
    recipient: composerDraft.recipient,
    partner: composerPartner.partner,
    encrypted: sendTransportRead.encrypted,
    message: composerDraft.message,
    apiStatus: connectionStatusRead.apiStatus,
    contactDirectory: contactDirectoryRead.directory,
    myAddress: inboxFeedRead.myAddress,
    sending: attachmentBar.sending,
    attachedTxtFile: attachmentBar.attachedTxtFile,
    attachedBlobBase64: attachmentBar.attachedBlobBase64,
    attachedAudioBase64: attachmentBar.attachedAudioBase64,
    hasLoraAttachment: attachmentBar.attachedLora != null,
    onMessageChange: composerDraft.onMessageChange,
    clearAttachments: attachmentBar.clearCompactAttachment,
    onStatusFeedback: (msg, st = 'success') => {
      deps.setStatus(st)
      deps.setStatusMsg(msg)
    },
    onTelegramDelivered: ({ recipientKey, text }) => {
      recordTelegramOutgoing(deps.appendMeshMessage, inboxFeedRead.myAddress, recipientKey, text)
    },
  })

  const syncPartnerAndRecipient = useCallback(
    (v: string) => {
      const t = v.trim().toLowerCase()
      deps.setPartner(t)
      if (composerSendPath.isPrivate) composerDraft.onRecipientChange(t)
    },
    [composerSendPath.isPrivate, deps.setPartner, composerDraft.onRecipientChange]
  )

  const voicePort = deps.messengerPorts.voiceRecordSendPanel
  if (!voicePort) {
    throw new Error('useChatViewSendPanelProps: messengerPorts.voiceRecordSendPanel fehlt')
  }

  const sendPanelProps = {
    ...deps.messengerPorts.composerDraft,
    ...deps.messengerPorts.sendTransportRead,
    ...deps.messengerPorts.sendMeshFunkOptions,
    ...voicePort,
    ...attachmentBar,
    isPrivate: composerSendPath.isPrivate,
    loraOnlineFallbackOffer: deps.loraOnlineFallbackOffer,
    onConfirmLoraOnline: deps.confirmLoraSendViaOnline,
    onDismissLoraOnlineFallback: deps.dismissLoraOnlineFallback,
    apiStatus: connectionStatusRead.apiStatus,
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
    meshPlaintextToNodeEnabled: meshSendOptions.meshPlaintextToNodeEnabled,
    onMeshPlaintextToNodeEnabledChange: meshSendOptions.setMeshPlaintextToNodeEnabled,
    meshPlaintextNodeId: meshSendOptions.meshPlaintextNodeId,
    onMeshPlaintextNodeIdChange: meshSendOptions.setMeshPlaintextNodeId,
    meshtasticChannelIndex: meshSendOptions.meshtasticChannelIndex,
    onMeshtasticChannelIndexChange: meshSendOptions.setMeshtasticChannelIndex,
    showMeshtasticChannelIndexInput: deps.expertTools,
    onManualRefresh: async () => {
      await deps.refreshApiStatus?.()
      await deps.loadMessages('reset')
    },
    contactDirectory: contactDirectoryRead.directory,
    isGroupChannel: composerSendPath.isGroup,
    groupMailboxSendAll: groupSendPanelContext.groupMailboxSendAll,
    groupMemberCount: groupSendPanelContext.groupMemberCount,
    groupTeamBroadcastReady: groupSendPanelContext.groupTeamBroadcastReady,
    partner: composerPartner.partner,
    onPartnerChange: syncPartnerAndRecipient,
    myAddress: inboxFeedRead.myAddress,
    hideComposerIotaRecipient:
      composerSendPath.isPrivate &&
      sendTransportRead.encrypted &&
      sendTransportRead.forcedTransport === 'internet' &&
      composerSendPath.composerDelivery === 'chain',
    onStatusFeedback: (msg, st = 'success') => {
      deps.setStatus(st)
      deps.setStatusMsg(msg)
    },
    composerDelivery: composerSendPath.composerDelivery,
    messagingPersistenceMode: sendTransportChoice.messagingPersistenceMode,
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
    isPinnwandChannel:
      composerSendPath.channelMode != null && isPinnwandChannel(composerSendPath.channelMode),
    pinnwandBroadcastAddress: deps.pinnwandBroadcastAddress,
    canPostToPinnwand: deps.canPostToPinnwand,
  } satisfies ChatViewSendPanelProps

  return { sendPanelProps, syncPartnerAndRecipient }
}
