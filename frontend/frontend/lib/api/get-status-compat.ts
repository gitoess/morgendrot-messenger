import type { ApiResponse } from '../types'
import { fetchStatus, type ApiStatusFetchOk } from '@/frontend/lib/api/status'

/** Für Dashboard-Kompatibilität: nutze bevorzugt `fetchStatus()`; dieses Mapping bleibt für ältere Aufrufer. */
export const getStatus = (): Promise<
  ApiResponse<{
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
  }>
> =>
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
    const t = s as ApiStatusFetchOk
    const raw = t as ApiStatusFetchOk & { version?: string }
    return {
      ok: !!t.backendRunning,
      data: {
        network: t.rpcUrlLabel || t.network || '—',
        address: t.myAddress || '',
        packageId: t.packageId || '',
        backendOnline: !!t.backendRunning,
        chatConnected: !!t.connected,
        signer: t.signer,
        vaultHasLocal: t.vaultStatus?.hasLocal,
        version: typeof raw.version === 'string' ? raw.version : undefined,
      },
      ...(t.locked && { locked: true }),
    }
  })
