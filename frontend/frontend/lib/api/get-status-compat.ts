import type { ApiResponse } from '../types'
import { fetchStatus, type ApiStatusFetchOk } from '@/frontend/lib/api/status'
import { shouldPreferStandaloneHandoffStatus } from '@/frontend/lib/capacitor-standalone-bootstrap'

export type LegacyGetStatusData = {
  network: string
  address: string
  packageId: string
  /** Backend-Prozess erreichbar (GET /api/status). */
  backendOnline: boolean
  /** Messenger-Peer (/connect) — nicht dasselbe wie Backend. */
  chatConnected: boolean
  /** IOTA-Signatur-Backend: cli | sdk | remote — siehe `docs/RECOVERY-PHRASE-BACKUP.md`. */
  signer?: string
  /** Lokale Vault-Datei vorhanden (GET /api/status → vaultStatus.hasLocal). */
  vaultHasLocal?: boolean
  /** Optional aus GET /api/status (Legacy-Dashboard). */
  version?: string
  /** z. B. `boss` | `messenger` — für Werkstatt-APIs (Einsatz-Templates). */
  role?: string
}

export type LegacyGetStatusResponse = ApiResponse<LegacyGetStatusData> & { locked?: true }

/** Reines Mapping für Tests (§ H.1a); gleiche Logik wie `getStatus` nach erfolgreichem `fetchStatus`. */
export function mapApiStatusFetchOkToLegacyGetStatusResponse(t: ApiStatusFetchOk): LegacyGetStatusResponse {
  const raw = t as ApiStatusFetchOk & { version?: string }
  return {
    ok: !!t.backendRunning || t.fromLocalHandoff === true || shouldPreferStandaloneHandoffStatus(),
    data: {
      network: t.rpcUrlLabel || t.network || '—',
      address: t.myAddress || '',
      packageId: t.packageId || '',
      backendOnline: !!t.backendRunning,
      chatConnected: !!t.connected,
      signer: t.signer,
      vaultHasLocal: t.vaultStatus?.hasLocal,
      version: typeof raw.version === 'string' ? raw.version : undefined,
      role: typeof t.role === 'string' ? t.role : undefined,
    },
    ...(t.locked && { locked: true }),
  }
}

/** Für Dashboard-Kompatibilität: nutze bevorzugt `fetchStatus()`; dieses Mapping bleibt für ältere Aufrufer. */
export const getStatus = (): Promise<LegacyGetStatusResponse> =>
  fetchStatus().then((s) => {
    if (!('pollClockHint' in s)) {
      return {
        ok: false,
        data: {
          network: '—',
          address: '',
          packageId: '',
          backendOnline: false,
          chatConnected: false,
        },
      }
    }
    return mapApiStatusFetchOkToLegacyGetStatusResponse(s as ApiStatusFetchOk)
  })
