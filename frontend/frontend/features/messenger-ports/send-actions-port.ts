import type { ChatSendHandleOptions } from '@/frontend/features/send/chat-send-handle-options'

export type SendComposerStatus = 'idle' | 'success' | 'error'

/** Senden, Abbrechen, Composer-Statuszeile und LoRa-Fallback (P5a). */
export type SendActionsPort = {
  readonly status: SendComposerStatus
  readonly statusMsg: string
  readonly onStatusChange: (v: SendComposerStatus) => void
  readonly onStatusMsgChange: (v: string) => void
  readonly onStatusFeedback: (msg: string, st?: SendComposerStatus) => void
  readonly onSend: (opts?: ChatSendHandleOptions) => void | Promise<void>
  readonly onCancelSend?: () => void
  readonly loraOnlineFallbackOffer: { reasonLabel: string } | null
  readonly onConfirmLoraSendViaOnline: () => void | Promise<void>
  readonly onDismissLoraOnlineFallback: () => void
}

export function asSendActions(actions: SendActionsPort): SendActionsPort {
  return actions
}
