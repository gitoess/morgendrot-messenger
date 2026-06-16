import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'

/** Kanal, Gruppe und Identität — Shell-Routing (P9). */
export type ShellRoutingPort = {
  readonly channelMode: MessengerChatChannel
  readonly isPrivate: boolean
  readonly isGroup: boolean
  readonly activeGroup: MessengerGroupDefinition | null
  readonly refreshMessengerGroups: () => void
  readonly role: string
  readonly myAddress: string
  /** Von der App-Schale gesetzt (z. B. ChatView-Tab-Umschaltung). */
  readonly onChannelModeChange?: (mode: MessengerChatChannel) => void
}

export function asShellRouting(routing: ShellRoutingPort): ShellRoutingPort {
  return routing
}
