import type { ApiResponse } from './types'
import { fetchStatus, unlockBackend } from '@/frontend/lib/api/status'

export { executeCommand } from '@/frontend/lib/api/execute-command'

export type { HierarchyPermissions, VaultStatus, ApiStatus } from '@/frontend/lib/api/status'
export { fetchStatus, unlockBackend }

export {
  sendMessage,
  sendEncryptedMessageWithTimeout,
  purgeMailboxMessage,
} from '@/frontend/lib/api/chat-commands'

export type { MeshV2Wire } from '@/frontend/lib/api/mesh-morg-pkg'
export { meshBuildV2Wires, meshDecryptV2Wire, morgPkgExport, morgPkgImport } from '@/frontend/lib/api/mesh-morg-pkg'

export { fetchInbox, fetchAllInboxMessagesForExport } from '@/frontend/lib/api/inbox'

export { fetchPackageIdHistory } from '@/frontend/lib/api/package-id-history'

export { setPackageIdCommand, startHandshake, connect } from '@/frontend/lib/api/package-connect'

export {
  createKey,
  createKeys,
  transferKey,
  purgeKey,
  listKeys,
} from '@/frontend/lib/api/keys'

export {
  createTicket,
  createTickets,
  useTicket,
  transferTicket,
  purgeTicket,
  listTickets,
} from '@/frontend/lib/api/tickets'

export {
  getDeviceStatus,
  sendHeartbeat,
  setHeartbeatInterval,
  setHeartbeatEnabled,
} from '@/frontend/lib/api/device-heartbeat'

export type { AuditEvent } from '@/frontend/lib/api/monitor-audit'
export { fetchMonitorStatus, fetchAuditEvents } from '@/frontend/lib/api/monitor-audit'

export type { PersonalSecretEntry } from '@/frontend/lib/api/vault-personal-secrets'
export { fetchVaultPersonalSecrets, saveVaultPersonalSecrets } from '@/frontend/lib/api/vault-personal-secrets'

export {
  vaultSave,
  vaultLoad,
  vaultListLocalFiles,
  vaultLoadFromChain,
  vaultOnchain,
  emergencyPurge,
  vaultLockCommand,
} from '@/frontend/lib/api/vault-commands'

export {
  compactImageEncode,
  loraProgressiveEncode,
  loraProgressiveFuse,
  messengerAudioToOpus,
} from '@/frontend/lib/api/media'

export { clearLocalHistory } from '@/frontend/lib/api/clear-local-history'
export type { ShadowSweepApiResult } from '@/frontend/lib/api/shadow-sweep'
export { postShadowSweep } from '@/frontend/lib/api/shadow-sweep'

export { setBossRole, sendBossCommand, transferCoins } from '@/frontend/lib/api/boss-transfer'

export { fetchHelp } from '@/frontend/lib/api/help'
export { restartBackend } from '@/frontend/lib/api/backend-restart'

// Status (für Dashboard: nutze fetchStatus(); getStatus bleibt für Kompatibilität)
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

export { revealVaultSignerImport } from '@/frontend/lib/api/vault-signer-import'

export type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
export {
  applyInitialProfileProvisioning,
  fetchContactDirectory,
  saveContactEntry,
  exportContactMeshEncrypted,
  importContactMeshEncrypted,
} from '@/frontend/lib/api/contacts'
