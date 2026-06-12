import type { ApiStatus } from '@/frontend/lib/api/status'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { InboxSourceFilter } from '@/frontend/lib/inbox-source-filter'
import type {
  MessengerCapabilitiesMatrix,
  TransportChannel,
} from '@morgendrot/shared/messenger-capabilities-matrix'

export type { MessengerCapabilitiesMatrix, TransportChannel }

/** Sendepfad-Buttons im Composer-Header → Transport-Kanal in der Capabilities-Matrix. */
export type ComposerSendPathKey = 'internet' | 'mesh' | 'adhoc' | 'telegram'

/** Aufgelöste Matrix aus Status-API (Handoff-Runtime) oder undefined → Legacy ROLE_ID. */
export function getStatusCapabilities(status: ApiStatus | null | undefined): MessengerCapabilitiesMatrix | undefined {
  return status?.capabilities
}

export function canTransportRead(status: ApiStatus | null | undefined, channel: TransportChannel): boolean {
  const cap = getStatusCapabilities(status)?.transport[channel]
  if (cap) return cap.read
  const roleId = status?.roleId ?? 0
  return (roleId & 4) !== 0
}

export function canTransportWrite(status: ApiStatus | null | undefined, channel: TransportChannel): boolean {
  const cap = getStatusCapabilities(status)?.transport[channel]
  if (cap) return cap.write
  const roleId = status?.roleId ?? 0
  return (roleId & 2) !== 0
}

export function composerSendPathToTransportChannel(path: ComposerSendPathKey): TransportChannel {
  switch (path) {
    case 'internet':
      return 'iota'
    case 'mesh':
      return 'lora'
    case 'adhoc':
      return 'ble'
    case 'telegram':
      return 'telegram'
  }
}

export function canComposerSendPathWrite(
  status: ApiStatus | null | undefined,
  path: ComposerSendPathKey
): boolean {
  return canTransportWrite(status, composerSendPathToTransportChannel(path))
}

export function composerSendPathWriteDeniedReason(
  status: ApiStatus | null | undefined,
  path: ComposerSendPathKey
): string | null {
  if (canComposerSendPathWrite(status, path)) return null
  const ch = composerSendPathToTransportChannel(path)
  const cap = getStatusCapabilities(status)?.transport[ch]
  if (cap?.read && !cap.write) return 'Nur Lese-Berechtigung (Handoff-Rechte).'
  return 'Keine Schreibberechtigung für diesen Kanal (Handoff-Rechte).'
}

export function activeSendPathWriteDeniedReason(
  status: ApiStatus | null | undefined,
  forcedTransport: ForcedTransport,
  composerDelivery: ComposerDeliveryChannel = 'chain'
): string | null {
  if (composerDelivery === 'telegram') {
    return composerSendPathWriteDeniedReason(status, 'telegram')
  }
  if (forcedTransport === 'internet' || forcedTransport === 'mesh' || forcedTransport === 'adhoc') {
    return composerSendPathWriteDeniedReason(status, forcedTransport)
  }
  return null
}

export function isPlaintextSendBlockedByCapabilities(
  status: ApiStatus | null | undefined,
  encrypted: boolean,
  forcedTransport: ForcedTransport
): boolean {
  if (encrypted) return false
  if (!requiresForceEncryption(status)) return false
  return forcedTransport === 'mesh' || forcedTransport === 'adhoc'
}

export function plaintextSendBlockedByCapabilitiesReason(
  status: ApiStatus | null | undefined,
  encrypted: boolean,
  forcedTransport: ForcedTransport
): string | null {
  if (!isPlaintextSendBlockedByCapabilities(status, encrypted, forcedTransport)) return null
  return 'Klartext auf Funk/Ad-hoc ist durch Handoff-Rechte gesperrt (nur verschlüsselt).'
}

export function canCreateGroupCapability(status: ApiStatus | null | undefined): boolean {
  const p = getStatusCapabilities(status)?.product
  if (p) return p.canCreateGroup
  return true
}

export function canExportDataCapability(status: ApiStatus | null | undefined): boolean {
  const p = getStatusCapabilities(status)?.product
  if (p) return p.canExportData
  return (status?.role || '').trim().toLowerCase() === 'boss'
}

export function exportDataDeniedReason(status: ApiStatus | null | undefined): string | null {
  if (canExportDataCapability(status)) return null
  return 'Keine Berechtigung zum Exportieren von Daten (Handoff-Rechte).'
}

/** Posteingang Kanal-Filter — Quelle nur wenn Leserecht auf dem Transport. */
export function inboxSourceFilterReadAllowed(
  status: ApiStatus | null | undefined,
  filter: InboxSourceFilter
): boolean {
  if (filter === 'all') return true
  if (filter === 'telegram') return canTransportRead(status, 'telegram')
  if (filter === 'funk') return canTransportRead(status, 'lora')
  if (filter === 'mailbox' || filter === 'group' || filter === 'lagebild') {
    return canTransportRead(status, 'iota')
  }
  return true
}

export function inboxSourceFilterDeniedReason(
  status: ApiStatus | null | undefined,
  filter: InboxSourceFilter
): string | null {
  if (inboxSourceFilterReadAllowed(status, filter)) return null
  if (filter === 'telegram') return 'Keine Lese-Berechtigung für Telegram (Handoff-Rechte).'
  if (filter === 'funk') return 'Keine Lese-Berechtigung für Funk (Handoff-Rechte).'
  return 'Keine Lese-Berechtigung für Online/Mailbox (Handoff-Rechte).'
}

export function requiresForceEncryption(status: ApiStatus | null | undefined): boolean {
  return getStatusCapabilities(status)?.security.forceEncryptionOnly === true
}
