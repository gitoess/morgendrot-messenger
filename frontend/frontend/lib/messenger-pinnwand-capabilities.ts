import type { ApiStatus } from '@/frontend/lib/api/status'
import type { Message } from '@/frontend/lib/types'
import {
  canAccessEinsatzleitung,
  isSimpleUiMode,
} from '@/frontend/lib/messenger-role-capabilities'

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

/** Kanal-Tab „Lagebild“ / „Pinnwand“ — alle Rollen, wenn Brett konfiguriert (Wanderer: nur dann sichtbar). */
export function showPinnwandChannelTab(
  status: ApiStatus | null | undefined,
  _role?: string | null | undefined
): boolean {
  return isPinnwandBroadcastConfigured(status)
}

/** Kompaktes Lagebild oben im 1:1 — Helfer/Simple; Führung nutzt den Kanal-Tab. */
export function showPinnwandInboxStrip(
  status: ApiStatus | null | undefined,
  role: string | null | undefined,
  channelMode: 'private' | 'group' | 'pinnwand' | null | undefined
): boolean {
  if (channelMode != null && channelMode !== 'private') return false
  if (!isPinnwandBroadcastConfigured(status)) return false
  if (canAccessEinsatzleitung(role)) return false
  return isMessengerHelperRole(role) || isSimpleUiMode(status)
}

export type PinnwandMatchContext = {
  broadcastAddress: string
  myAddress?: string
  authorizedSenders?: string[]
}

function resolvePinnwandMatchContext(
  broadcastAddrOrCtx: string | PinnwandMatchContext
): PinnwandMatchContext {
  if (typeof broadcastAddrOrCtx === 'string') {
    return { broadcastAddress: broadcastAddrOrCtx }
  }
  return broadcastAddrOrCtx
}

/** Lagebild-Post: Klartext an die feste Brett-Adresse (kein verschlüsselter 1:1-Verkehr). */
export function messageBelongsToPinnwand(
  msg: Message,
  broadcastAddrOrCtx: string | PinnwandMatchContext
): boolean {
  const ctx = resolvePinnwandMatchContext(broadcastAddrOrCtx)
  const b = ctx.broadcastAddress.trim().toLowerCase()
  if (!ADDR_64.test(b)) return false
  if (msg.encrypted === true) return false
  const r = (msg.recipient ?? '').trim().toLowerCase()
  if (r !== b) return false

  const my = (ctx.myAddress ?? '').trim().toLowerCase()
  if (my && b === my) {
    const from = (msg.from ?? '').trim().toLowerCase()
    if (from === my) return true
    const authorized = (ctx.authorizedSenders ?? [])
      .map((a) => a.trim().toLowerCase())
      .filter((a) => ADDR_64.test(a))
    if (authorized.length === 0) return false
    return authorized.includes(from)
  }
  return true
}

export type MessengerPinnwandCapabilities = {
  configured: boolean
  broadcastAddress: string
  canPost: boolean
  showChannelTab: boolean
  showInboxStrip: boolean
  broadcastEqualsMyAddress: boolean
}

export function buildPinnwandMatchContext(
  status: ApiStatus | null | undefined,
  myAddress?: string
): PinnwandMatchContext | null {
  const broadcastAddress = getPinnwandBroadcastAddress(status)
  if (!isPinnwandBroadcastConfigured(status)) return null
  const my = (status?.myAddressFull ?? myAddress ?? '').trim().toLowerCase()
  return {
    broadcastAddress,
    myAddress: my || undefined,
    authorizedSenders: status?.broadcastPinnwand?.authorizedSenders ?? [],
  }
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
