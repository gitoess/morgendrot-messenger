import type { HandshakeOffersReadPort } from './handshake-offers-read-port'
import type { InboxHandshakePanelActionsPort } from './inbox-handshake-panel-actions-port'
import type { InboxPanelLocalActionsPort } from './inbox-panel-local-actions-port'

/** In main-content/shell angereicherte Ports (Handshake-Poll, Inbox-Aktionen, P7). */
export type ChatViewShellOrchestrationPort = {
  readonly handshakeOffersRead: HandshakeOffersReadPort
  readonly inboxHandshakePanelActions: InboxHandshakePanelActionsPort
  readonly inboxPanelLocalActions: InboxPanelLocalActionsPort
}

export function assembleShellOrchestrationPort(
  shell: ChatViewShellOrchestrationPort
): ChatViewShellOrchestrationPort {
  return shell
}
