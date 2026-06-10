import type { ApiStatus } from '@/frontend/lib/api/status'
import type { Message } from '@/frontend/lib/types'
import { canAccessEinsatzleitung } from '@/frontend/lib/messenger-role-capabilities'

const ADDR_64 = /^0x[a-f0-9]{64}$/

export function getPinnwandBroadcastAddress(status: ApiStatus | null | undefined): string {
  return (status?.broadcastPinnwand?.address ?? '').trim().toLowerCase()
}

export function isPinnwandBroadcastConfigured(status: ApiStatus | null | undefined): boolean {
  const addr = getPinnwandBroadcastAddress(status)
  return Boolean(status?.broadcastPinnwand?.enabled && ADDR_64.test(addr))
}

/** Helfer-Rollen ohne Pinnwand-Tab (Lesen über Streifen im 1:1). */
export function isMessengerHelperRole(role: string | null | undefined): boolean {
  const r = (role ?? '').trim().toLowerCase()
  return r === 'arbeiter' || r === 'lock'
}

/**
 * Darf auf das IOTA-Brett posten (Server prüft Whitelist; UI spiegelt Status + Rolle).
 * @see docs/BROADCAST-PINNWAND.md, docs/ROLLEN-MODELL-CONSUMER-EINSATZ.md
 */
export function canPostToPinnwand(
  status: ApiStatus | null | undefined,
  role?: string | null
): boolean {
  if (!isPinnwandBroadcastConfigured(status)) return false
  if (status?.broadcastPinnwand?.myAddressAuthorized === true) return true
  if (canAccessEinsatzleitung(role)) return true
  return false
}

/** Kanal-Tab „Pinnwand“ — Führung / Wanderer, nicht Arbeiter-Helfer. */
export function showPinnwandChannelTab(
  status: ApiStatus | null | undefined,
  role: string | null | undefined
): boolean {
  if (!isPinnwandBroadcastConfigured(status)) return false
  if (isMessengerHelperRole(role)) return false
  return true
}

/** Helfer: kompaktes Lagebild oben im 1:1-Posteingang. */
export function showPinnwandInboxStrip(
  status: ApiStatus | null | undefined,
  role: string | null | undefined,
  channelMode: 'private' | 'group' | 'pinnwand' | null | undefined
): boolean {
  if (channelMode != null && channelMode !== 'private') return false
  if (!isPinnwandBroadcastConfigured(status)) return false
  return isMessengerHelperRole(role)
}

/** Posteingang Pinnwand-Kanal: nur Nachrichten an die Brett-Adresse. */
export function messageBelongsToPinnwand(msg: Message, broadcastAddr: string): boolean {
  const b = broadcastAddr.trim().toLowerCase()
  if (!ADDR_64.test(b)) return false
  const r = (msg.recipient ?? '').trim().toLowerCase()
  return r === b
}

export type MessengerPinnwandCapabilities = {
  configured: boolean
  broadcastAddress: string
  canPost: boolean
  showChannelTab: boolean
  showInboxStrip: boolean
  broadcastEqualsMyAddress: boolean
}

export function getMessengerPinnwandCapabilities(
  status: ApiStatus | null | undefined,
  role: string | null | undefined,
  channelMode: 'private' | 'group' | 'pinnwand' | null | undefined,
  myAddressLine?: string
): MessengerPinnwandCapabilities {
  const broadcastAddress = getPinnwandBroadcastAddress(status)
  const configured = isPinnwandBroadcastConfigured(status)
  const my = (status?.myAddressFull ?? myAddressLine ?? '').trim().toLowerCase()
  return {
    configured,
    broadcastAddress,
    canPost: canPostToPinnwand(status, role),
    showChannelTab: showPinnwandChannelTab(status, role),
    showInboxStrip: showPinnwandInboxStrip(status, role, channelMode),
    broadcastEqualsMyAddress: Boolean(
      configured && my && ADDR_64.test(my) && broadcastAddress === my
    ),
  }
}
