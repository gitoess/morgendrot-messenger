'use client'

import { useCallback, useEffect, useMemo } from 'react'
import type { ChatViewSendPanelProps } from '@/frontend/components/chat-view-send-panel'
import type { ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'
import { buildGroupSendPanelContext } from '@/frontend/features/send/chat-view-group-send-context'
import { useChatViewTelegramComposer } from '@/frontend/hooks/use-chat-view-telegram-composer'
import { useEncryptedRecipientHandshakeStatus } from '@/frontend/hooks/use-encrypted-recipient-handshake-status'
import {
  parseComposerIotaRecipientAddresses,
  resolveComposerIotaAddress,
} from '@/frontend/lib/composer-recipient-fields'
import {
  contactHandshakeBadgeKind,
  resolveContactHandshakeStatus,
} from '@/frontend/lib/contact-handshake-ui'
import { isValidRecipient0x } from '@/frontend/lib/encrypted-recipient-handshake-status'
import { isPinnwandChannel } from '@/frontend/lib/messenger-chat-channel'
import { recordTelegramOutgoingMany } from '@/frontend/lib/record-telegram-outgoing'
import { resolveContactSidebarDisplayName } from '@/frontend/lib/conversation-sidebar-items'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'
import { resolveActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'
import type { ChatViewActiveConversationBarProps } from '@/frontend/components/chat-view-active-conversation-bar'

export type ChatViewActiveConversationContext = {
  inboxPartnerKey: string | null
  inboxConversationGroupId: string | null
  inboxPartnerFiltersArmed: boolean
  directory: Record<string, ContactMeshEntryClient>
}

export type ChatViewSendPanelPropsDeps = {
  messengerPorts: ChatViewMessengerPorts
  activeGroup: MessengerGroupDefinition | null
  expertTools: boolean
  pinnwandBroadcastAddress?: string
  canPostToPinnwand: boolean
  vaultBannerActions?: ChatViewVaultBannerActions
  onOpenPhonebook?: () => void
  activeConversation?: ChatViewActiveConversationContext
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
    offlineMailboxQueueRead,
    handshakeActions,
    handshakeOffersRead,
    sendActions,
    inboxActions,
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

  const iotaBroadcastTargets = useMemo(
    () =>
      parseComposerIotaRecipientAddresses(
        composerDraft.recipient,
        composerPartner.partner,
        sendTransportRead.encrypted
      ),
    [composerDraft.recipient, composerPartner.partner, sendTransportRead.encrypted]
  )

  const isIotaBroadcastAll =
    composerSendPath.isPrivate &&
    composerSendPath.composerDelivery === 'chain' &&
    sendTransportRead.forcedTransport === 'internet' &&
    deps.activeConversation?.inboxPartnerFiltersArmed === false &&
    iotaBroadcastTargets.length > 1

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
    incomingOffers: [...handshakeOffersRead.pendingOffers],
    outgoingOffers: [...handshakeOffersRead.outgoingOffers],
  })

  const handleEncryptedHandshakeForComposerRecipient = useCallback(async () => {
    const addr = composerEncryptedRecipient.trim().toLowerCase()
    if (!isValidRecipient0x(addr)) return
    composerPartner.onPartnerChange(addr)
    await handshakeActions.onHandshakeForAddress(addr)
    encryptedRecipientHandshake.refresh()
    window.setTimeout(() => void handshakeOffersRead.reload(), 3000)
  }, [
    composerEncryptedRecipient,
    composerPartner,
    handshakeActions,
    encryptedRecipientHandshake,
    handshakeOffersRead,
  ])

  const handleEncryptedAcceptForComposerRecipient = useCallback(async () => {
    const addr = composerEncryptedRecipient.trim().toLowerCase()
    if (!isValidRecipient0x(addr)) return
    composerPartner.onPartnerChange(addr)
    await handshakeActions.onConnectAcceptForAddress(addr)
    encryptedRecipientHandshake.refresh()
    await connectionStatusRead.refreshApiStatus()
    window.setTimeout(() => void handshakeOffersRead.reload(), 4000)
  }, [
    composerEncryptedRecipient,
    composerPartner,
    handshakeActions,
    encryptedRecipientHandshake,
    connectionStatusRead.refreshApiStatus,
    handshakeOffersRead,
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
    onStatusFeedback: sendActions.onStatusFeedback,
    onTelegramDelivered: ({ recipientKeys, recipientKey, text }) => {
      recordTelegramOutgoingMany(
        inboxActions.appendMeshMessage,
        inboxFeedRead.myAddress,
        recipientKeys?.length ? recipientKeys : [recipientKey],
        text
      )
    },
  })

  const syncPartnerAndRecipient = useCallback(
    (v: string) => {
      const t = v.trim().toLowerCase()
      composerPartner.onPartnerChange(t)
      if (composerSendPath.isPrivate) composerDraft.onRecipientChange(t)
    },
    [composerSendPath.isPrivate, composerPartner, composerDraft.onRecipientChange]
  )

  const voicePort = deps.messengerPorts.voiceRecordSendPanel
  if (!voicePort) {
    throw new Error('useChatViewSendPanelProps: messengerPorts.voiceRecordSendPanel fehlt')
  }

  const activePartnerKey = deps.activeConversation?.inboxPartnerKey?.trim().toLowerCase() ?? ''
  const activeGroupId = deps.activeConversation?.inboxConversationGroupId?.trim() ?? ''
  const hasActiveDirectConversation =
    composerSendPath.isPrivate &&
    deps.activeConversation?.inboxPartnerFiltersArmed === true &&
    isValidRecipient0x(activePartnerKey) &&
    composerSendPath.composerDelivery === 'chain'
  const hasActiveGroupConversation =
    composerSendPath.isGroup &&
    deps.activeConversation?.inboxPartnerFiltersArmed === true &&
    Boolean(activeGroupId) &&
    composerSendPath.composerDelivery === 'chain'

  const activeConversationBar: ChatViewActiveConversationBarProps | undefined = useMemo(() => {
    if (isIotaBroadcastAll) {
      return {
        displayName: `Alle · ${iotaBroadcastTargets.length} Empfänger`,
        addressLine: `${iotaBroadcastTargets.length} IOTA-Adressen — pro Empfänger eine Transaktion`,
        handshakeBadge: 'none',
        encrypted: sendTransportRead.encrypted,
        forcedTransport: sendTransportRead.forcedTransport,
        onEncryptedChange: sendTransportChoice.onEncryptedChange,
      }
    }
    if (hasActiveGroupConversation) {
      const group =
        deps.activeGroup ??
        readMessengerGroups().find((g) => g.id === activeGroupId) ??
        null
      return {
        displayName: group?.name ?? 'Gruppe',
        addressLine: group?.teamMailboxObjectId?.trim()
          ? 'Team-Postfach · Broadcast'
          : `${group?.memberAddresses.length ?? 0} Mitglieder`,
        handshakeBadge: 'none',
        encrypted: sendTransportRead.encrypted,
        forcedTransport: sendTransportRead.forcedTransport,
        onEncryptedChange: sendTransportChoice.onEncryptedChange,
      }
    }
    if (!hasActiveDirectConversation || !deps.activeConversation) return undefined
    const handshakeStatus = resolveContactHandshakeStatus({
      address: activePartnerKey,
      connectedAddresses: [...connectionStatusRead.connectedAddresses],
      incomingOffers: [...handshakeOffersRead.pendingOffers],
      outgoingOffers: [...handshakeOffersRead.outgoingOffers],
    })
    return {
      displayName: resolveContactSidebarDisplayName(deps.activeConversation.directory, activePartnerKey),
      addressLine: activePartnerKey,
      handshakeBadge: contactHandshakeBadgeKind(handshakeStatus),
      encrypted: sendTransportRead.encrypted,
      forcedTransport: sendTransportRead.forcedTransport,
      onEncryptedChange: sendTransportChoice.onEncryptedChange,
      encryptedRecipientHandshakeStatus: sendTransportRead.encrypted
        ? encryptedRecipientHandshake.status
        : undefined,
      sending: attachmentBar.sending,
      myAddress: inboxFeedRead.myAddress,
      onEncryptedHandshakeForRecipient: handleEncryptedHandshakeForComposerRecipient,
      onEncryptedAcceptHandshakeForRecipient: handleEncryptedAcceptForComposerRecipient,
    }
  }, [
    isIotaBroadcastAll,
    iotaBroadcastTargets.length,
    hasActiveGroupConversation,
    activeGroupId,
    deps.activeGroup,
    hasActiveDirectConversation,
    deps.activeConversation,
    activePartnerKey,
    connectionStatusRead.connectedAddresses,
    handshakeOffersRead.pendingOffers,
    handshakeOffersRead.outgoingOffers,
    sendTransportRead.encrypted,
    sendTransportRead.forcedTransport,
    sendTransportChoice.onEncryptedChange,
    encryptedRecipientHandshake.status,
    attachmentBar.sending,
    inboxFeedRead.myAddress,
    handleEncryptedHandshakeForComposerRecipient,
    handleEncryptedAcceptForComposerRecipient,
  ])

  const encryptionModeToggle = useMemo(() => {
    if (activeConversationBar) return undefined
    if (composerSendPath.composerDelivery !== 'chain') return undefined
    if (sendTransportRead.forcedTransport !== 'internet') return undefined
    if (!composerSendPath.isPrivate && !composerSendPath.isGroup) return undefined
    return {
      encrypted: sendTransportRead.encrypted,
      forcedTransport: sendTransportRead.forcedTransport,
      onEncryptedChange: sendTransportChoice.onEncryptedChange,
    }
  }, [
    activeConversationBar,
    composerSendPath.composerDelivery,
    composerSendPath.isPrivate,
    composerSendPath.isGroup,
    sendTransportRead.encrypted,
    sendTransportRead.forcedTransport,
    sendTransportChoice.onEncryptedChange,
  ])

  const sendPanelProps = {
    ...deps.messengerPorts.composerDraft,
    ...deps.messengerPorts.sendTransportRead,
    ...deps.messengerPorts.sendMeshFunkOptions,
    ...voicePort,
    ...attachmentBar,
    isPrivate: composerSendPath.isPrivate,
    loraOnlineFallbackOffer: sendActions.loraOnlineFallbackOffer,
    onConfirmLoraOnline: sendActions.onConfirmLoraSendViaOnline,
    onDismissLoraOnlineFallback: sendActions.onDismissLoraOnlineFallback,
    apiStatus: connectionStatusRead.apiStatus,
    statusPollAttempted: connectionStatusRead.statusPollAttempted,
    onSend: sendActions.onSend,
    onCancelSend: sendActions.onCancelSend,
    status: sendActions.status,
    statusMsg: sendActions.statusMsg,
    offlineMailboxQueuePending: offlineMailboxQueueRead.pending,
    offlineMailboxQueueUntrustedTimeCount: offlineMailboxQueueRead.untrustedTimeCount,
    offlineMailboxQueueBackoffCount: offlineMailboxQueueRead.backoffCount,
    offlineMailboxQueueErrorHint: offlineMailboxQueueRead.errorHint,
    offlineMailboxQueueItems: [...offlineMailboxQueueRead.items],
    onRemoveOfflineMailboxQueueItems: offlineMailboxQueueRead.removeItems,
    meshPlaintextToNodeEnabled: meshSendOptions.meshPlaintextToNodeEnabled,
    onMeshPlaintextToNodeEnabledChange: meshSendOptions.setMeshPlaintextToNodeEnabled,
    meshPlaintextNodeId: meshSendOptions.meshPlaintextNodeId,
    onMeshPlaintextNodeIdChange: meshSendOptions.setMeshPlaintextNodeId,
    meshtasticChannelIndex: meshSendOptions.meshtasticChannelIndex,
    onMeshtasticChannelIndexChange: meshSendOptions.setMeshtasticChannelIndex,
    showMeshtasticChannelIndexInput: deps.expertTools,
    onManualRefresh: async () => {
      await connectionStatusRead.refreshApiStatus()
      await inboxActions.loadMessages('reset')
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
      (hasActiveDirectConversation && !isIotaBroadcastAll) ||
      (composerSendPath.isPrivate &&
        sendTransportRead.encrypted &&
        sendTransportRead.forcedTransport === 'internet' &&
        composerSendPath.composerDelivery === 'chain' &&
        !isIotaBroadcastAll),
    activeConversationBar,
    encryptionModeToggle,
    onStatusFeedback: sendActions.onStatusFeedback,
    composerDelivery: composerSendPath.composerDelivery,
    messagingPersistenceMode: sendTransportChoice.messagingPersistenceMode,
    onTelegramSend: telegramComposer.handleTelegramOnly,
    canSendTelegram: telegramComposer.canSendTelegramOnly,
    telegramBusy: telegramComposer.telegramOnlyBusy,
    onNavigateHomeWhenLocked: deps.vaultBannerActions?.onNavigateHomeWhenLocked,
    composerMailboxObjectId: composerSendPath.composerMailboxObjectId,
    onComposerMailboxObjectIdChange: composerSendPath.onComposerMailboxObjectIdChange,
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
    activeSendPath: resolveActiveSendPath(
      composerSendPath.composerDelivery,
      sendTransportRead.forcedTransport
    ),
  } satisfies ChatViewSendPanelProps

  return { sendPanelProps, syncPartnerAndRecipient }
}
