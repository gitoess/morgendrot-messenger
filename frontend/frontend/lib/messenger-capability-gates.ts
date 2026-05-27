import type { ApiStatus } from '@/frontend/lib/api/status'
import type {
  MessengerCapabilitiesMatrix,
  TransportChannel,
} from '@morgendrot/shared/messenger-capabilities-matrix'

export type { MessengerCapabilitiesMatrix, TransportChannel }

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

export function canCreateGroupCapability(status: ApiStatus | null | undefined): boolean {
  const p = getStatusCapabilities(status)?.product
  if (p) return p.canCreateGroup
  return false
}

export function canExportDataCapability(status: ApiStatus | null | undefined): boolean {
  const p = getStatusCapabilities(status)?.product
  if (p) return p.canExportData
  return (status?.role || '').trim().toLowerCase() === 'boss'
}

export function requiresForceEncryption(status: ApiStatus | null | undefined): boolean {
  return getStatusCapabilities(status)?.security.forceEncryptionOnly === true
}
