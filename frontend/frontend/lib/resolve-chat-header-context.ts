import type { ApiStatus } from '@/frontend/lib/api/status'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import { isGroupChannel, isPinnwandChannel } from '@/frontend/lib/messenger-chat-channel'
import { pinnwandSidebarLabel } from '@/frontend/lib/pinnwand-display'
import type { ActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'

export type ChatHeaderContext = {
  title: string
  subtitle?: string
  /** inbox = Posteingang-Übersicht (kein Schloss-Icon). */
  icon?: 'lock' | 'inbox'
}

/** Titel für den ungefilterten Posteingang — abhängig vom Sendepfad. */
export function posteingangTitleForSendPath(p: {
  activeSendPath?: ActiveSendPath
  iotaPathFocus?: boolean
}): string {
  if (p.activeSendPath === 'telegram') return 'Posteingang Telegram'
  if (p.activeSendPath === 'mesh' || p.activeSendPath === 'adhoc') return 'Posteingang Funk'
  if (p.activeSendPath === 'internet' && p.iotaPathFocus) return 'Posteingang IOTA'
  if (p.activeSendPath === 'internet') return 'Posteingang Online'
  return 'Posteingang Alle'
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
  activeSendPath?: ActiveSendPath
  iotaPathFocus?: boolean
}): ChatHeaderContext {
  if (isPinnwandChannel(p.channelMode)) {
    return {
      title: pinnwandSidebarLabel(p.role, p.apiStatus),
      subtitle: 'Team-Brett · nur Online',
      icon: 'inbox',
    }
  }

  if (isGroupChannel(p.channelMode)) {
    if (p.inboxConversationGroupId && p.activeConversationTitle) {
      return {
        title: `Gruppenchat: ${p.activeConversationTitle}`,
        subtitle: p.activeConversationSubtitle,
        icon: 'lock',
      }
    }
    return {
      title: 'Gruppenchat',
      subtitle: 'Gruppe in der Sidebar wählen oder anlegen',
      icon: 'lock',
    }
  }

  if (p.showAllConversationsActive) {
    return {
      title: posteingangTitleForSendPath({
        activeSendPath: p.activeSendPath,
        iotaPathFocus: p.iotaPathFocus,
      }),
      subtitle: undefined,
      icon: 'inbox',
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
      icon: 'lock',
    }
  }

  return {
    title: posteingangTitleForSendPath({
      activeSendPath: p.activeSendPath,
      iotaPathFocus: p.iotaPathFocus,
    }),
    subtitle: 'Kontakt oder Gruppe in der Sidebar wählen',
    icon: 'inbox',
  }
}
