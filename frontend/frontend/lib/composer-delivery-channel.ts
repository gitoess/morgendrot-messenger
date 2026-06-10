/**
 * Zustellkanal im Composer: Chain (IOTA/Mailbox/Funk) vs. reines Telegram — getrennt vom Sendepfad online/funk.
 */

import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { resolveComposerIotaAddress } from '@/frontend/lib/composer-recipient-fields'

export type ComposerDeliveryChannel = 'chain' | 'telegram'

export function needsComposerIotaAddress(p: {
  deliveryChannel: ComposerDeliveryChannel
  encrypted: boolean
  forcedTransport: ForcedTransport
  meshPlaintextToNodeEnabled: boolean
}): boolean {
  if (p.deliveryChannel === 'telegram') return false
  if (p.encrypted) return true
  if (p.forcedTransport === 'internet') return true
  return false
}

export function needsComposerMailboxUi(p: {
  deliveryChannel: ComposerDeliveryChannel
  forcedTransport: ForcedTransport
  recipient: string
  partner?: string
  encrypted: boolean
}): boolean {
  if (p.deliveryChannel === 'telegram') return false
  if (p.forcedTransport !== 'internet') return false
  const addr = resolveComposerIotaAddress(p.recipient, p.partner ?? '', p.encrypted).trim()
  return /^0x[a-f0-9]{64}$/i.test(addr)
}

export function showTelegramDeliveryInHeader(p: { channelMode: MessengerChatChannel }): boolean {
  return p.channelMode === 'private'
}

export function needsComposerTelegramId(p: { deliveryChannel: ComposerDeliveryChannel; isPrivate: boolean }): boolean {
  return p.isPrivate && p.deliveryChannel === 'telegram'
}

/** Empfänger-Zeile im Composer (gleicher Platz für 0x oder Telegram). */
export function showComposerRecipientRow(p: {
  isPrivate: boolean
  deliveryChannel: ComposerDeliveryChannel
  encrypted: boolean
  forcedTransport: ForcedTransport
  meshPlaintextToNodeEnabled: boolean
}): boolean {
  if (!p.isPrivate) return !p.encrypted
  if (needsComposerTelegramId({ deliveryChannel: p.deliveryChannel, isPrivate: p.isPrivate })) return true
  if (needsComposerIotaAddress(p)) return true
  if (p.forcedTransport === 'mesh') return true
  if (p.forcedTransport === 'internet') return true
  return false
}
