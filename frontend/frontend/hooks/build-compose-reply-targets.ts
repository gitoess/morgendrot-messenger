import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { ChatViewPanelMessengerPortsComposerReplyTargets } from '@/frontend/hooks/use-chat-view-panel-messenger-ports'

export type BuildComposeReplyTargetsInput = {
  onChannelModeChange?: (c: MessengerChatChannel) => void
  setForcedTransport: (v: ForcedTransport) => void
  setComposerDelivery: (v: ComposerDeliveryChannel) => void
  setPartner: (v: string) => void
  setRecipient: (v: string) => void
  setEncrypted: (v: boolean) => void
  onComposerMailboxObjectIdChange: (id: string) => void
  setMeshtasticChannelIndex: (v: number | undefined) => void
  setMeshPlaintextNodeId: (v: string) => void
  setMeshPlaintextToNodeEnabled: (v: boolean) => void
  selectInboxPartnerForSend: (address: string) => void
  setMessage: (v: string) => void
  refreshMessengerGroups: () => void
}

/** Reply-/Inbox-Antworten: Port-Callbacks → `inbox-reply-context` / Panel-Orchestrierung. */
export function buildComposeReplyTargets(
  input: BuildComposeReplyTargetsInput
): ChatViewPanelMessengerPortsComposerReplyTargets {
  return {
    onChannelModeChange: input.onChannelModeChange,
    setForcedTransport: input.setForcedTransport,
    setComposerDelivery: input.setComposerDelivery,
    setPartner: input.setPartner,
    setRecipient: input.setRecipient,
    setEncrypted: input.setEncrypted,
    setComposerMailboxObjectId: input.onComposerMailboxObjectIdChange,
    setMeshtasticChannelIndex: input.setMeshtasticChannelIndex,
    setMeshPlaintextNodeId: input.setMeshPlaintextNodeId,
    setMeshPlaintextToNodeEnabled: input.setMeshPlaintextToNodeEnabled,
    selectInboxPartnerForSend: input.selectInboxPartnerForSend,
    setMessage: input.setMessage,
    refreshMessengerGroups: input.refreshMessengerGroups,
  }
}
