import type { ApiStatus } from '@/frontend/lib/api'

/** API-/Verbindungs-Snapshot für Header, Send und Inbox (P8: inkl. Refresh-Aktion). */
export type ConnectionStatusReadPort = {
  readonly apiStatus: ApiStatus | null
  readonly basisUnreachable: boolean | undefined
  readonly statusCacheAgeMinutes: number | null
  readonly packageIdMismatch: boolean
  readonly deviceTimeTrustWarn: boolean
  /** Peers für Handshake-UI (Status + Offline-Cache). */
  readonly connectedAddresses: readonly string[]
  readonly refreshApiStatus: () => void | Promise<void>
  /** Erster Live-Status-Poll abgeschlossen (Cold-Start-Send-Gating). */
  readonly statusPollAttempted: boolean
}

export function asConnectionStatusRead(
  apiStatus: ApiStatus | null,
  basisUnreachable: boolean | undefined,
  statusCacheAgeMinutes: number | null,
  packageIdMismatch: boolean,
  deviceTimeTrustWarn: boolean,
  connectedAddresses: readonly string[],
  refreshApiStatus: () => void | Promise<void>,
  statusPollAttempted: boolean
): ConnectionStatusReadPort {
  return {
    apiStatus,
    basisUnreachable,
    statusCacheAgeMinutes,
    packageIdMismatch,
    deviceTimeTrustWarn,
    connectedAddresses,
    refreshApiStatus,
    statusPollAttempted,
  }
}
