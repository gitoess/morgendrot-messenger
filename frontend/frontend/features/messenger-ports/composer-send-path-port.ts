import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'

/** Kanal + Zustellweg für Sichtbarkeits-Gates (Partner-Panel, Sendepfad). */
export type ComposerSendPathPort = {
  readonly composerDelivery: ComposerDeliveryChannel
  readonly onComposerDeliveryChange: (d: ComposerDeliveryChannel) => void
  readonly channelMode?: MessengerChatChannel
  readonly isGroup: boolean
  readonly isPrivate: boolean
}

export function asComposerSendPath(
  composerDelivery: ComposerDeliveryChannel,
  onComposerDeliveryChange: (d: ComposerDeliveryChannel) => void,
  channelMode: MessengerChatChannel | undefined,
  isGroup: boolean,
  isPrivate: boolean
): ComposerSendPathPort {
  return { composerDelivery, onComposerDeliveryChange, channelMode, isGroup, isPrivate }
}
