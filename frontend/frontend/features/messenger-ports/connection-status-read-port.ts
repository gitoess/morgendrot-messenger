import type { ApiStatus } from '@/frontend/lib/api'

/** API-/Verbindungs-Snapshot (readonly) für Header, Send und Inbox. */
export type ConnectionStatusReadPort = {
  readonly apiStatus: ApiStatus | null
  readonly basisUnreachable: boolean | undefined
  readonly statusCacheAgeMinutes: number | null
  readonly packageIdMismatch: boolean
  readonly deviceTimeTrustWarn: boolean
  /** Peers für Handshake-UI (Status + Offline-Cache). */
  readonly connectedAddresses: readonly string[]
}

export function asConnectionStatusRead(
  apiStatus: ApiStatus | null,
  basisUnreachable: boolean | undefined,
  statusCacheAgeMinutes: number | null,
  packageIdMismatch: boolean,
  deviceTimeTrustWarn: boolean,
  connectedAddresses: readonly string[]
): ConnectionStatusReadPort {
  return {
    apiStatus,
    basisUnreachable,
    statusCacheAgeMinutes,
    packageIdMismatch,
    deviceTimeTrustWarn,
    connectedAddresses,
  }
}
