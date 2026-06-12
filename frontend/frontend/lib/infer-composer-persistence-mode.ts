import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import { normalizeMailboxObjectIdInput } from '@/frontend/lib/composer-mailbox-object-id'
import { readContactSendMailboxTarget } from '@/frontend/lib/contact-mailbox-slots'
import { resolveComposerIotaAddress } from '@/frontend/lib/composer-recipient-fields'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'

const ADDR_64 = /^0x[a-f0-9]{64}$/i

/** Chain-Persistenz: Composer-0x, Kontakt-Slot oder „meine aktive“ → Mailbox; sonst Event. */
export function inferMessagingPersistenceModeFromComposer(p: {
  recipient: string
  partner?: string
  encrypted: boolean
  forcedTransport: ForcedTransport
  deliveryChannel: ComposerDeliveryChannel
  composerMailboxObjectId?: string
  contactDirectory?: Record<string, ContactMeshEntryClient>
  isGroupChannel?: boolean
  groupMailboxSendAll?: boolean
}): MessagingPersistenceMode {
  if (p.deliveryChannel === 'telegram') return 'event'
  if (p.forcedTransport !== 'internet') return 'event'
  if (p.isGroupChannel && p.groupMailboxSendAll) return 'mailbox'

  const addr = resolveComposerIotaAddress(p.recipient, p.partner ?? '', p.encrypted).trim().toLowerCase()
  if (!ADDR_64.test(addr)) return 'event'

  if (normalizeMailboxObjectIdInput(p.composerMailboxObjectId ?? '')) return 'mailbox'

  const resolved = resolveOutboundMailboxObjectId(
    p.contactDirectory ?? {},
    addr,
    readContactSendMailboxTarget(addr),
    p.composerMailboxObjectId
  )
  if (resolved) return 'mailbox'
  return 'event'
}
