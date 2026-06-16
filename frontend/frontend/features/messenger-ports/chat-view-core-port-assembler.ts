/**
 * Zentrale Port-Assembler für Chat-View-Core-Slices.
 * Bündelt messenger-ports-Typen für Panel-Hooks und Tests (P1).
 */

import { asComposerDraft, type ComposerDraftPort, type ComposerDraftSendFlowPort } from './composer-draft-port'
import { asInboxFeedRead, type InboxFeedReadPort } from './inbox-feed-read-port'
import {
  asSendMeshFunkOptions,
  asSendTransportChoice,
  asSendTransportRead,
  type SendMeshFunkOptionsPort,
  type SendTransportChoicePort,
  type SendTransportReadPort,
} from './send-transport-ports'
import {
  asVoiceRecordSendPanel,
  type VoiceRecordFromHook,
  type VoiceRecordSendPanelPort,
} from './voice-record-send-panel-port'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import type { Message } from '@/frontend/lib/types'

export type ChatViewComposerDraftSlice = {
  message: string
  recipient: string
  setMessage: (v: string) => void
  setRecipient: (v: string) => void
}

export type ChatViewTransportSlice = {
  encrypted: boolean
  setEncrypted: (v: boolean) => void
  forcedTransport: ForcedTransport
  setForcedTransport: (t: ForcedTransport) => void
  messagingPersistenceMode: MessagingPersistenceMode
  setMessagingPersistenceMode: (m: MessagingPersistenceMode) => void
}

export type ChatViewMeshFunkSlice = {
  meshLoRaImagesEnabled: boolean
  setMeshLoRaImagesEnabled: (v: boolean) => void
  meshSelfArchiveAfterLoRa: boolean
  setMeshSelfArchiveAfterLoRa: (v: boolean) => void
}

export type ChatViewInboxFeedSlice = {
  messages: readonly Message[]
  myAddress: string
}

export type ChatViewMessengerPorts = {
  composerDraft: ComposerDraftPort
  composerDraftSendFlow: ComposerDraftSendFlowPort
  sendTransportChoice: SendTransportChoicePort
  sendTransportRead: SendTransportReadPort
  sendMeshFunkOptions: SendMeshFunkOptionsPort
  inboxFeedRead: InboxFeedReadPort
  voiceRecordSendPanel: VoiceRecordSendPanelPort | null
}

export function assembleComposerDraftPort(slice: ChatViewComposerDraftSlice): ComposerDraftPort {
  return asComposerDraft(slice.message, slice.recipient, slice.setMessage, slice.setRecipient)
}

export function assembleComposerDraftSendFlowPort(slice: ChatViewComposerDraftSlice): ComposerDraftSendFlowPort {
  return {
    message: slice.message,
    recipient: slice.recipient,
    setMessage: slice.setMessage,
  }
}

export function assembleSendTransportChoicePort(slice: ChatViewTransportSlice): SendTransportChoicePort {
  return asSendTransportChoice(
    slice.encrypted,
    slice.setEncrypted,
    slice.forcedTransport,
    slice.setForcedTransport,
    slice.messagingPersistenceMode,
    slice.setMessagingPersistenceMode
  )
}

export function assembleSendTransportReadPort(slice: Pick<ChatViewTransportSlice, 'encrypted' | 'forcedTransport'>): SendTransportReadPort {
  return asSendTransportRead(slice.encrypted, slice.forcedTransport)
}

export function assembleSendMeshFunkOptionsPort(slice: ChatViewMeshFunkSlice): SendMeshFunkOptionsPort {
  return asSendMeshFunkOptions(
    slice.meshLoRaImagesEnabled,
    slice.setMeshLoRaImagesEnabled,
    slice.meshSelfArchiveAfterLoRa,
    slice.setMeshSelfArchiveAfterLoRa
  )
}

export function assembleInboxFeedReadPort(slice: ChatViewInboxFeedSlice): InboxFeedReadPort {
  return asInboxFeedRead(slice.messages, slice.myAddress)
}

export function assembleVoiceRecordSendPanelPort(
  fromHook: VoiceRecordFromHook,
  sosVoiceAwaitingSend: boolean
): VoiceRecordSendPanelPort {
  return asVoiceRecordSendPanel(fromHook, sosVoiceAwaitingSend)
}

/** Alle Standard-Ports aus den Core-Slices (ohne AttachmentBar — bleibt im Send-Panel-Hook). */
export function assembleChatViewMessengerPorts(input: {
  composerDraft: ChatViewComposerDraftSlice
  transport: ChatViewTransportSlice
  meshFunk: ChatViewMeshFunkSlice
  inboxFeed: ChatViewInboxFeedSlice
  voiceFromHook?: VoiceRecordFromHook
  sosVoiceAwaitingSend?: boolean
}): ChatViewMessengerPorts {
  return {
    composerDraft: assembleComposerDraftPort(input.composerDraft),
    composerDraftSendFlow: assembleComposerDraftSendFlowPort(input.composerDraft),
    sendTransportChoice: assembleSendTransportChoicePort(input.transport),
    sendTransportRead: assembleSendTransportReadPort(input.transport),
    sendMeshFunkOptions: assembleSendMeshFunkOptionsPort(input.meshFunk),
    inboxFeedRead: assembleInboxFeedReadPort(input.inboxFeed),
    voiceRecordSendPanel:
      input.voiceFromHook != null
        ? assembleVoiceRecordSendPanelPort(input.voiceFromHook, input.sosVoiceAwaitingSend ?? false)
        : null,
  }
}
