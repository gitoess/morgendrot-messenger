export type { CommandResponse, StatusResponse } from '@/frontend/lib/api/command-response-types'
export {
  getConfig,
  setConfig,
  getCurrentIds,
  getPackageIdHistory,
  getConnectAddresses,
  checkChainReachable,
} from '@/frontend/lib/api/dashboard-rest'
export type { ConfigItem, ConfigResponse } from '@/frontend/lib/api/dashboard-rest'

export { executeCommand } from '@/frontend/lib/api/execute-command'

export type {
  HierarchyPermissions,
  VaultStatus,
  ApiStatus,
  ApiStatusFetchOk,
  ApiStatusFetchResult,
} from '@/frontend/lib/api/status'
export { fetchStatus, unlockBackend } from '@/frontend/lib/api/status'

export {
  sendMessage,
  sendEncryptedMessageWithTimeout,
  sosGatewayAckDigest,
  purgeMailboxMessage,
} from '@/frontend/lib/api/chat-commands'

export type {
  OfflineMailboxQueueItem,
  OfflineMailboxKind,
  OfflineQueueItemStatus,
  EnqueueOfflineMailboxResult,
  ComputeCanonicalMsgRefV1Input,
} from '@/frontend/lib/api/offline-queue'
export {
  OFFLINE_QUEUE_ITEM_STATUS,
  isOfflineMailboxQueueEnabled,
  loadOfflineMailboxQueue,
  saveOfflineMailboxQueue,
  enqueueOfflineMailboxFailure,
  drainOfflineMailboxQueue,
  getOfflineMailboxQueueCount,
  nextOfflineMailboxClientOutSeq,
  offlineMailboxDedupKey,
  computeCanonicalMsgRefV1,
  stableOfflineMailboxThreadId,
  normalizeMailboxAddressUtf8,
} from '@/frontend/lib/api/offline-queue'

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

export { getStatus } from '@/frontend/lib/api/get-status-compat'

export { revealVaultSignerImport } from '@/frontend/lib/api/vault-signer-import'

export type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
export {
  applyInitialProfileProvisioning,
  fetchContactDirectory,
  saveContactEntry,
  exportContactMeshEncrypted,
  importContactMeshEncrypted,
} from '@/frontend/lib/api/contacts'

export type { EinsatzRoleTemplate } from '@/frontend/lib/api/einsatz-role-templates'
export { fetchEinsatzRoleTemplates, saveEinsatzRoleTemplates } from '@/frontend/lib/api/einsatz-role-templates'
