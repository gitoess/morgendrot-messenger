import type { ApiStatus } from '@/frontend/lib/api/status'
import type { Message } from '@/frontend/lib/types'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import { addressMatchesIdentity } from '@/frontend/features/inbox/inbox-partner-filter'
import {
  canAccessEinsatzleitung,
  isSimpleUiMode,
} from '@/frontend/lib/messenger-role-capabilities'
import { hasPinnwandPostMarker } from '@/frontend/lib/pinnwand-post-marker'

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
  channelMode: MessengerChatChannel | null | undefined
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
  /** Brett-0x = eigene Wallet — 1:1-Klartext braucht Marker. */
  boardSameAsMy?: boolean
  /** Brett = persönliches Postfach — nur markierte Posts, kein offener Klartext. */
  requiresPinnwandMarker?: boolean
}

function addressesSameIdentity(a: string, b: string): boolean {
  const left = a.trim()
  const right = b.trim()
  if (!left || !right) return false
  const al = left.toLowerCase()
  const bl = right.toLowerCase()
  if (ADDR_64.test(al) && ADDR_64.test(bl) && al === bl) return true
  return addressMatchesIdentity(left, right) || addressMatchesIdentity(right, left)
}

function resolvePinnwandMatchContext(
  broadcastAddrOrCtx: string | PinnwandMatchContext
): PinnwandMatchContext {
  if (typeof broadcastAddrOrCtx === 'string') {
    return { broadcastAddress: broadcastAddrOrCtx }
  }
  return broadcastAddrOrCtx
}

export function isPinnwandBoardSameAsMyAddress(ctx: PinnwandMatchContext): boolean {
  if (ctx.boardSameAsMy === true) return true
  const b = ctx.broadcastAddress.trim()
  const my = (ctx.myAddress ?? '').trim()
  return addressesSameIdentity(b, my)
}

/** Brett = Wallet (MY / Whitelist-0x) — nur Marker/broadcast:-Key zählt. */
function isPersonalWalletBoard(ctx: PinnwandMatchContext): boolean {
  if (ctx.requiresPinnwandMarker === true) return true
  if (isPinnwandBoardSameAsMyAddress(ctx)) return true
  const b = ctx.broadcastAddress.trim().toLowerCase()
  const authorized = (ctx.authorizedSenders ?? [])
    .map((a) => a.trim().toLowerCase())
    .filter((a) => ADDR_64.test(a))
  return authorized.includes(b)
}

export function messageHasPinnwandBroadcastKey(msg: Message): boolean {
  const key = (msg.dedupKey ?? msg.id ?? '').trim().toLowerCase()
  return key.startsWith('broadcast:')
}

export function messageIsMarkedPinnwandPost(msg: Message): boolean {
  return msg.pinnwandPost === true || hasPinnwandPostMarker(msg.content)
}

/**
 * Lagebild-Post: Klartext an die feste Brett-Adresse (kein verschlüsselter 1:1-Verkehr).
 * Wenn Brett = MY_ADDRESS: **nur** Marker `[[MORG_PINNWAND_V1]]` oder broadcast:-Key —
 * auch „Ausgang / An mich“ (eigene 0x) ohne Marker ist sonst 1:1, kein Brett-Post.
 */
export function messageBelongsToPinnwand(
  msg: Message,
  broadcastAddrOrCtx: string | PinnwandMatchContext
): boolean {
  const ctx = resolvePinnwandMatchContext(broadcastAddrOrCtx)
  const b = ctx.broadcastAddress.trim().toLowerCase()
  if (!ADDR_64.test(b)) return false
  if (msg.encrypted === true) return false
  if (msg.chainPurgeKind === 'team-broadcast') return false
  const dk = msg.dedupKey?.trim() ?? ''
  if (dk.startsWith('team:')) return false

  const r = (msg.recipient ?? '').trim().toLowerCase()
  if (r !== b) return false

  if (messageHasPinnwandBroadcastKey(msg)) return true
  if (messageIsMarkedPinnwandPost(msg)) return true

  const from = (msg.from ?? '').trim().toLowerCase()
  const authorized = (ctx.authorizedSenders ?? [])
    .map((a) => a.trim().toLowerCase())
    .filter((a) => ADDR_64.test(a))

  /** Selbstgespräch an die Brett-0x ohne Marker = 1:1 (pi2/pi3/„An mich“). */
  if (from && r && from === r) return false

  if (isPersonalWalletBoard(ctx)) return false

  if (authorized.length > 0) {
    if (!authorized.includes(from)) return false
    return true
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
  const myHook = (myAddress ?? '').trim().toLowerCase()
  const myStatus = (status?.myAddressFull ?? status?.myAddress ?? '').trim().toLowerCase()
  const my =
    myStatus && ADDR_64.test(myStatus)
      ? myStatus
      : myHook && ADDR_64.test(myHook)
        ? myHook
        : myStatus || myHook
  const authorizedSenders = status?.broadcastPinnwand?.authorizedSenders ?? []
  const boardSameAsMy = addressesSameIdentity(broadcastAddress, my)
  const requiresPinnwandMarker =
    boardSameAsMy ||
    status?.broadcastPinnwand?.myAddressAuthorized === true ||
    authorizedSenders.some((a) => addressesSameIdentity(a, broadcastAddress))
  return {
    broadcastAddress,
    myAddress: my || undefined,
    authorizedSenders,
    boardSameAsMy,
    requiresPinnwandMarker,
  }
}

export function getMessengerPinnwandCapabilities(
  status: ApiStatus | null | undefined,
  role: string | null | undefined,
  channelMode: MessengerChatChannel | null | undefined,
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
