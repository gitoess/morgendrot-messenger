import type { ApiResponse } from '../types'
import { fetchStatus } from '@/frontend/lib/api/status'

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
  }>
> =>
  fetchStatus().then((s) => ({
    ok: !!s.backendRunning,
    data: {
      network: s.rpcUrlLabel || s.network || '—',
      address: s.myAddress || '',
      packageId: s.packageId || '',
      backendOnline: !!s.backendRunning,
      chatConnected: !!s.connected,
      signer: s.signer,
      vaultHasLocal: s.vaultStatus?.hasLocal,
    },
    ...(s.locked && { locked: true }),
  }))
