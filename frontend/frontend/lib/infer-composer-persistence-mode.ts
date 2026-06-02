import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import { normalizeMailboxObjectIdInput } from '@/frontend/lib/composer-mailbox-object-id'
import { resolveComposerIotaAddress } from '@/frontend/lib/composer-recipient-fields'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'

const ADDR_64 = /^0x[a-f0-9]{64}$/i

/** Chain-Persistenz: leeres Mailbox-Feld = Event; gültige 0x im Mailbox-Feld = Mailbox. */
export function inferMessagingPersistenceModeFromComposer(p: {
  recipient: string
  partner?: string
  encrypted: boolean
  forcedTransport: ForcedTransport
  deliveryChannel: ComposerDeliveryChannel
  composerMailboxObjectId?: string
  isGroupChannel?: boolean
  groupMailboxSendAll?: boolean
}): MessagingPersistenceMode {
  if (p.deliveryChannel === 'telegram') return 'event'
  if (p.forcedTransport !== 'internet') return 'event'
  if (p.isGroupChannel && p.groupMailboxSendAll) return 'mailbox'

  const addr = resolveComposerIotaAddress(p.recipient, p.partner ?? '', p.encrypted).trim().toLowerCase()
  if (!ADDR_64.test(addr)) return 'event'

  if (normalizeMailboxObjectIdInput(p.composerMailboxObjectId ?? '')) return 'mailbox'
  return 'event'
}
