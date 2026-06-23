import type { ApiStatus } from '@/frontend/lib/api/status'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import { isGroupChannel, isPinnwandChannel } from '@/frontend/lib/messenger-chat-channel'
import { pinnwandSidebarLabel } from '@/frontend/lib/pinnwand-display'

export type ChatHeaderContext = {
  title: string
  subtitle?: string
}

/** Kontextzeile im Chat-Kopf — leitet sich aus Sidebar-Auswahl ab, nicht aus Modus-Buttons. */
export function resolveChatHeaderContext(p: {
  channelMode: MessengerChatChannel
  role: string
  apiStatus: ApiStatus | null | undefined
  activeConversationTitle: string | null
  activeConversationSubtitle?: string
  showAllConversationsActive: boolean
  inboxConversationGroupId: string | null
}): ChatHeaderContext {
  if (isPinnwandChannel(p.channelMode)) {
    return {
      title: pinnwandSidebarLabel(p.role, p.apiStatus),
      subtitle: 'Team-Brett · nur Online',
    }
  }

  if (isGroupChannel(p.channelMode)) {
    if (p.inboxConversationGroupId && p.activeConversationTitle) {
      return {
        title: `Gruppenchat: ${p.activeConversationTitle}`,
        subtitle: p.activeConversationSubtitle,
      }
    }
    return {
      title: 'Gruppenchat',
      subtitle: 'Gruppe in der Sidebar wählen oder anlegen',
    }
  }

  if (p.showAllConversationsActive) {
    return {
      title: 'Alle Chats',
      subtitle: 'Gesamter Posteingang',
    }
  }

  if (p.activeConversationTitle) {
    const prefix =
      p.activeConversationTitle === 'Ich'
        ? ''
        : p.activeConversationTitle === 'Einsatz-Alarmgruppe' ||
            p.activeConversationTitle.toLowerCase().includes('alarm')
          ? ''
          : 'Chat mit '
    return {
      title: `${prefix}${p.activeConversationTitle}`,
      subtitle: p.activeConversationSubtitle,
    }
  }

  return {
    title: 'Chats',
    subtitle: 'Kontakt oder Gruppe in der Sidebar wählen',
  }
}
