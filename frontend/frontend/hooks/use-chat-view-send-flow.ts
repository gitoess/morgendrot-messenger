'use client'

/**
 * Orchestriert Senden: .morg-pkg (Import/Export), LoRa→Online-Bestätigung, IOTA/Mailbox + Mesh-Fallback.
 * Logik liegt in `use-chat-view-morg-pkg-actions`, `use-chat-view-confirm-lora-online`, `use-chat-view-handle-send`.
 */

import { useChatViewMorgPkgActions } from '@/frontend/hooks/use-chat-view-morg-pkg-actions'
import { useChatViewConfirmLoraOnline } from '@/frontend/hooks/use-chat-view-confirm-lora-online'
import { useChatViewHandleSend } from '@/frontend/hooks/use-chat-view-handle-send'
import type { UseChatViewSendFlowParams } from '@/frontend/hooks/use-chat-view-send-flow-types'

export type { ForcedTransport, MeshtasticBleSendApi } from '@/frontend/lib/chat-view-messenger-transport'
export type { UseChatViewSendFlowParams } from '@/frontend/hooks/use-chat-view-send-flow-types'

export function useChatViewSendFlow(p: UseChatViewSendFlowParams) {
  const morg = useChatViewMorgPkgActions(p)
  const confirmLoraSendViaOnline = useChatViewConfirmLoraOnline(p)
  const { handleSend, cancelSend } = useChatViewHandleSend(p)

  return {
    ...morg,
    confirmLoraSendViaOnline,
    handleSend,
    cancelSend,
  }
}
