'use client'

/**
 * Chat-View-Orchestrierung: drei Sub-Hooks (Composer, Inbox, Send) + Port-Assembler.
 * Meshtastic-First: Funk über `useMeshtasticBle` in der Send-Schicht.
 */

import { useCallback } from 'react'
import { buildChatViewCoreState } from '@/frontend/hooks/build-chat-view-core-state'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { useChatViewMessengerGroup } from '@/frontend/hooks/use-chat-view-messenger-group'
import { useChatViewComposerTransportState } from '@/frontend/hooks/use-chat-view-composer-transport-state'
import { useChatViewInboxOrchestration } from '@/frontend/hooks/use-chat-view-inbox-orchestration'
import { useChatViewSendOrchestration } from '@/frontend/hooks/use-chat-view-send-orchestration'
import {
  isGroupChannel,
  type MessengerChatChannel,
} from '@/frontend/lib/messenger-chat-channel'

export type UseChatViewCoreParams = {
  channelMode: MessengerChatChannel
  role: string
  myAddress: string
}

/**
 * Chat-View-Orchestrierung: drei Sub-Hooks (Composer, Inbox, Send) + Port-Assembler.
 * Meshtastic-First: Funk über `useMeshtasticBle` in der Send-Schicht.
 * Rückgabe: nur `messengerPorts` (P9).
 */
export function useChatViewCore(p: UseChatViewCoreParams) {
  const { channelMode, role, myAddress } = p
  const isGroup = isGroupChannel(channelMode)

  const { activeGroup, groupTeamMailboxId, refreshMessengerGroups } = useChatViewMessengerGroup(isGroup)
  const { directory, refresh: refreshContactDirectory, isMeshVerifiedForAddress } = useContactDirectory()

  const composer = useChatViewComposerTransportState({
    channelMode,
    isGroup,
    activeGroup,
    myAddress,
    directory,
  })

  const onMeshFirstTransportDefault = useCallback(
    (t: Parameters<typeof composer.setForcedTransport>[0]) => {
      composer.setForcedTransport(t)
    },
    [composer.setForcedTransport]
  )

  const inbox = useChatViewInboxOrchestration({
    channelMode,
    role,
    myAddress,
    groupTeamMailboxId,
    isPrivate: composer.isPrivate,
    showSetup: composer.showSetup,
    recipient: composer.recipient,
    partner: composer.partner,
    encrypted: composer.encrypted,
    setRecipient: composer.setRecipient,
    setSending: composer.setSending,
    setStatus: composer.setStatus,
    setStatusMsg: composer.setStatusMsg,
    setComposerMailboxObjectIdState: composer.setComposerMailboxObjectIdState,
    meshFirstTransportDefaultApplied: composer.meshFirstTransportDefaultApplied,
    onMeshFirstTransportDefault,
    directory,
    refreshContactDirectory,
    isMeshVerifiedForAddress,
  })

  const send = useChatViewSendOrchestration({
    channelMode,
    role,
    myAddress,
    isPrivate: composer.isPrivate,
    isGroup,
    activeGroup,
    message: composer.message,
    setMessage: composer.setMessage,
    recipient: composer.recipient,
    setRecipient: composer.setRecipient,
    partner: composer.partner,
    encrypted: composer.encrypted,
    forcedTransport: composer.forcedTransport,
    messagingPersistenceMode: composer.messagingPersistenceMode,
    composerMailboxObjectId: composer.composerMailboxObjectId,
    sending: composer.sending,
    setSending: composer.setSending,
    setStatus: composer.setStatus,
    setStatusMsg: composer.setStatusMsg,
    showSetup: composer.showSetup,
    setShowSetup: composer.setShowSetup,
    meshLoRaImagesEnabled: composer.meshLoRaImagesEnabled,
    meshSelfArchiveAfterLoRa: composer.meshSelfArchiveAfterLoRa,
    meshtasticChannelIndex: composer.meshtasticChannelIndex,
    morgPkgDeviceBusy: composer.morgPkgDeviceBusy,
    setMorgPkgDeviceBusy: composer.setMorgPkgDeviceBusy,
    morgPkgFileRef: composer.morgPkgFileRef,
    morgPkgDeviceFilesRef: composer.morgPkgDeviceFilesRef,
    setLoraMeshProgressLine: composer.setLoraMeshProgressLine,
    sosVoiceAwaitingSend: composer.sosVoiceAwaitingSend,
    setSosVoiceAwaitingSend: composer.setSosVoiceAwaitingSend,
    clearSosVoicePrompt: composer.clearSosVoicePrompt,
    apiStatus: inbox.apiStatus,
    refreshApiStatus: inbox.refreshApiStatus,
    deviceTimeTrustWarn: inbox.deviceTimeTrustWarn,
    basisUnreachable: inbox.basisUnreachable,
    directory: inbox.directory,
    loadMessages: inbox.loadMessages,
    setMessages: inbox.setMessages,
    appendMeshMessage: inbox.appendMeshMessage,
    appendMeshMessageWithInboundCapture: inbox.appendMeshMessageWithInboundCapture,
    onDelayMirrorPlaintext: inbox.onDelayMirrorPlaintext,
    refreshOfflineMailboxQueueCount: inbox.refreshOfflineMailboxQueueCount,
    clearMeshInboundText: inbox.clearMeshInboundText,
    drainMeshInboundText: inbox.drainMeshInboundText,
    selectInboxPartnerForSend: inbox.selectInboxPartnerForSend,
  })

  return buildChatViewCoreState({
    channelMode,
    role,
    myAddress,
    isGroup,
    activeGroup,
    refreshMessengerGroups,
    composer,
    inbox,
    send,
  })
}

export type ChatViewCoreState = ReturnType<typeof useChatViewCore>
