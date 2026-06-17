import type { ApiStatus } from '@/frontend/lib/api'
import type { ActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import { showPinnwandChannelTab } from '@/frontend/lib/messenger-pinnwand-capabilities'
import { pinnwandChannelTabLabel } from '@/frontend/lib/pinnwand-display'

export type SendPathRecipientChoice =
  | { kind: 'channel'; channel: MessengerChatChannel; label: string }
  | { kind: 'telegram-all'; label: 'Alle' }

/** Empfänger-Buttons je Sendepfad (erscheinen nach Pfad-Klick). */
export function recipientChoicesForSendPath(
  path: ActiveSendPath,
  role: string,
  apiStatus: ApiStatus | null | undefined
): SendPathRecipientChoice[] {
  switch (path) {
    case 'internet': {
      const choices: SendPathRecipientChoice[] = [
        { kind: 'channel', channel: 'private', label: '1:1' },
        { kind: 'channel', channel: 'group', label: 'Gruppe' },
      ]
      if (showPinnwandChannelTab(apiStatus, role)) {
        choices.push({
          kind: 'channel',
          channel: 'pinnwand',
          label: pinnwandChannelTabLabel(role, apiStatus),
        })
      }
      return choices
    }
    case 'mesh':
      return [
        { kind: 'channel', channel: 'private', label: '1:1' },
        { kind: 'channel', channel: 'group', label: 'Gruppe' },
      ]
    case 'telegram':
      return [
        { kind: 'channel', channel: 'private', label: '1:1' },
        { kind: 'telegram-all', label: 'Alle' },
      ]
    default:
      return []
  }
}
