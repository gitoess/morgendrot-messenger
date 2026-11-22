import type { Message } from '@/frontend/lib/types'
import { inboxTransportIconKey } from '@/frontend/lib/messenger-send-path-icons'
import { cn } from '@/lib/utils'

/** Chat-Blase: dieselben --path-* wie Sendepfad (messenger-appearance.css). */
export function inboxChatBubbleTransportClass(msg: Message, outgoing: boolean): string {
  const transports = Array.isArray(msg.transports) ? msg.transports : []
  let key: ReturnType<typeof inboxTransportIconKey> = null
  for (const t of transports) {
    key = inboxTransportIconKey(String(t), msg.source)
    if (key) break
  }
  if (!key) key = inboxTransportIconKey('', msg.source)

  const path =
    key === 'mesh'
      ? 'chat-bubble-path--mesh'
      : key === 'telegram'
        ? 'chat-bubble-path--telegram'
        : key === 'adhoc'
          ? 'chat-bubble-path--adhoc'
          : key === 'iota'
            ? 'chat-bubble-path--iota'
            : key === 'internet'
              ? 'chat-bubble-path--online'
              : 'chat-bubble-path--default'

  return cn(
    'chat-bubble-path',
    path,
    outgoing ? 'chat-bubble-path--out rounded-br-md' : 'chat-bubble-path--in rounded-bl-md'
  )
}
