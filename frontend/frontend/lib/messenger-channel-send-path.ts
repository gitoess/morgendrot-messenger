/**
 * Welche Kanäle (1:1 / Gruppe / Pinnwand) mit welchem Sendepfad sinnvoll sind.
 *
 * IOTA/online: alle drei.
 * Funk (Meshtastic): laut [Channel Configuration](https://meshtastic.org/docs/configuration/radio/channels/)
 *   — **1:1** = DM an Node (PKC ab FW 2.5) oder Klartext an Node;
 *   — **Gruppe** = Secondary Channel (gemeinsamer Name + PSK, AES256) — entspricht Meshtastic-Gruppenchat;
 *   — **Pinnwand** (IOTA-Brett) ≠ Funk **„An alle“** (Primary-Broadcast, nur 1:1 + Klartext).
 * Ad-hoc: nur 1:1 (BLE-Platzhalter).
 * Telegram: nur 1:1 (Mehrfach-Chat-IDs); Boss-Gruppenalarm → Roadmap § B4.
 */

import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'

export type ActiveSendPath = 'internet' | 'mesh' | 'adhoc' | 'telegram'

export function resolveActiveSendPath(
  composerDelivery: ComposerDeliveryChannel,
  forcedTransport: ForcedTransport
): ActiveSendPath {
  if (composerDelivery === 'telegram') return 'telegram'
  return forcedTransport
}

const MATRIX: Record<MessengerChatChannel, ReadonlySet<ActiveSendPath>> = {
  private: new Set(['internet', 'mesh', 'adhoc', 'telegram']),
  group: new Set(['internet', 'mesh']),
  pinnwand: new Set(['internet']),
  notes: new Set(['internet', 'mesh', 'adhoc', 'telegram']),
}

export function isChannelSendPathCompatible(
  channel: MessengerChatChannel,
  composerDelivery: ComposerDeliveryChannel,
  forcedTransport: ForcedTransport
): boolean {
  const path = resolveActiveSendPath(composerDelivery, forcedTransport)
  return MATRIX[channel].has(path)
}

export function isSendPathAllowedForChannel(channel: MessengerChatChannel, path: ActiveSendPath): boolean {
  return MATRIX[channel].has(path)
}

export function allowedSendPathsForChannel(channel: MessengerChatChannel): ActiveSendPath[] {
  return [...MATRIX[channel]]
}

export function sendPathDisabledReason(
  channel: MessengerChatChannel,
  path: ActiveSendPath
): string | null {
  if (isSendPathAllowedForChannel(channel, path)) return null
  switch (path) {
    case 'adhoc':
      return 'Ad-hoc nur im Kanal 1:1.'
    case 'telegram':
      return 'Telegram nur im Kanal 1:1 (Alarmgruppe unter „Alle“).'
    case 'mesh':
      return channel === 'pinnwand'
        ? 'Funk „An alle“ nur im Kanal 1:1 (Klartext). Pinnwand = Online (IOTA).'
        : 'Funk für diesen Kanal nicht verfügbar.'
    default:
      return 'Für diesen Kanal nicht verfügbar.'
  }
}

export function channelDisabledReason(
  channel: MessengerChatChannel,
  composerDelivery: ComposerDeliveryChannel,
  forcedTransport: ForcedTransport
): string | null {
  if (channel === 'notes') return null
  if (isChannelSendPathCompatible(channel, composerDelivery, forcedTransport)) return null
  const path = resolveActiveSendPath(composerDelivery, forcedTransport)
  switch (channel) {
    case 'group':
      if (path === 'adhoc') return 'Gruppenchat nicht per Ad-hoc.'
      if (path === 'telegram') return 'Gruppenchat nicht per Telegram — nur 1:1.'
      break
    case 'pinnwand':
      if (path === 'mesh')
        return 'Pinnwand = IOTA-Brett — Funk „An alle“ nur unter 1:1 + Klartext.'
      if (path === 'adhoc') return 'Pinnwand nicht per Ad-hoc.'
      if (path === 'telegram') return 'Pinnwand nicht per Telegram.'
      break
    default:
      break
  }
  return 'Kanal mit aktuellem Sendepfad nicht kombinierbar.'
}

/** Erzwingt kompatible Kombination (z. B. nach Profil-Wechsel). */
export function reconcileChannelSendPath(
  channel: MessengerChatChannel,
  composerDelivery: ComposerDeliveryChannel,
  forcedTransport: ForcedTransport
): {
  channel: MessengerChatChannel
  composerDelivery: ComposerDeliveryChannel
  forcedTransport: ForcedTransport
} {
  if (isChannelSendPathCompatible(channel, composerDelivery, forcedTransport)) {
    return { channel, composerDelivery, forcedTransport }
  }
  let nextDelivery = composerDelivery
  let nextTransport = forcedTransport
  let nextChannel = channel
  const path = resolveActiveSendPath(composerDelivery, forcedTransport)

  if (!isSendPathAllowedForChannel(channel, path)) {
    if (path === 'telegram' || path === 'adhoc') {
      nextDelivery = 'chain'
      nextTransport = 'internet'
    } else if (path === 'mesh' && channel === 'pinnwand') {
      nextTransport = 'internet'
    } else if (!isChannelSendPathCompatible(channel, nextDelivery, nextTransport)) {
      nextChannel = 'private'
    }
  }

  if (!isChannelSendPathCompatible(nextChannel, nextDelivery, nextTransport)) {
    nextChannel = 'private'
    nextDelivery = 'chain'
    nextTransport = 'internet'
  }

  return {
    channel: nextChannel,
    composerDelivery: nextDelivery,
    forcedTransport: nextTransport,
  }
}
