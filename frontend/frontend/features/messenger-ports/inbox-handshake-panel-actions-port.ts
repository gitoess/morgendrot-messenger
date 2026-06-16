import type { HandshakeOfferSource } from '@/frontend/lib/handshake-offer-delete'
import type { Message } from '@/frontend/lib/types'

/** Handshake- und Antwort-Aktionen im Posteingang (Shell-Orchestration, P7). */
export type InboxHandshakePanelActionsPort = {
  readonly pendingHandshakesLoading: boolean
  readonly pendingHandshakeCount: number
  readonly onAcceptPendingHandshake: (sender: string) => void | Promise<void>
  readonly onUseSenderAsPartnerFromInbox: (sender: string) => void
  readonly onReplyToMessage: (msg: Message) => void
  readonly onDeleteIncomingHandshake: (
    sender: string,
    nonce: string,
    source: HandshakeOfferSource
  ) => void | Promise<void>
  readonly onDeleteOutgoingHandshake: (
    recipient: string,
    nonce: string,
    source: HandshakeOfferSource
  ) => void | Promise<void>
  readonly onResendOutgoingHandshake: (recipient: string) => void | Promise<void>
}

export function asInboxHandshakePanelActions(
  actions: InboxHandshakePanelActionsPort
): InboxHandshakePanelActionsPort {
  return actions
}
