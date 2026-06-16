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
export { fetchStatus, readBootstrapCachedApiStatus, unlockBackend } from '@/frontend/lib/api/status'

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
  ParsedMailboxOutNonce,
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
  nextChainMessageNonceU64,
  offlineMailboxDedupKey,
  computeCanonicalMsgRefV1,
  stableOfflineMailboxThreadId,
  normalizeMailboxAddressUtf8,
  parseMailboxOutNonceMarker,
  prependMailboxOutNonceMarker,
  parseMailboxProtocolNonceU64FromWire,
} from '@/frontend/lib/api/offline-queue'

export type { MeshV2Wire } from '@/frontend/lib/api/mesh-morg-pkg'
export { meshBuildV2Wires, meshDecryptV2Wire, morgPkgExport, morgPkgImport } from '@/frontend/lib/api/mesh-morg-pkg'

export { fetchInbox, fetchAllInboxMessagesForExport } from '@/frontend/lib/api/inbox'

export { fetchPackageIdHistory } from '@/frontend/lib/api/package-id-history'

export {
  setPackageIdCommand,
  startHandshake,
  connect,
  findPeerHandshake,
  fetchPendingHandshakes,
  fetchHandshakeOffers,
  type PendingHandshakeOffer,
  type OutgoingHandshakeOffer,
} from '@/frontend/lib/api/package-connect'

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

export type { VaultNoteAttachment, VaultNoteAttachmentKind, VaultNoteEntry } from '@/frontend/lib/api/vault-notes'
export { fetchVaultNotes, saveVaultNotes } from '@/frontend/lib/api/vault-notes'
export { fetchVaultOnchainPreflight } from '@/frontend/lib/api/vault-onchain-preflight'
export type { VaultOnchainPreflight } from '@/frontend/lib/api/vault-onchain-preflight'
export { syncVaultChainConfig } from '@/frontend/lib/api/vault-sync-chain-config'

export {
  vaultSave,
  vaultLoad,
  vaultListLocalFiles,
  vaultLoadFromChain,
  vaultOnchain,
  emergencyPurge,
  vaultLockCommand,
  vaultChangePassword,
  vaultDeleteLocal,
} from '@/frontend/lib/api/vault-commands'

export { importVaultFileFromDevice } from '@/frontend/lib/api/vault-import'

export {
  compactImageEncode,
  loraProgressiveEncode,
  loraProgressiveFromCompactBlob,
  loraProgressiveFuse,
  messengerAudioToOpus,
} from '@/frontend/lib/api/media'

export { clearLocalHistory } from '@/frontend/lib/api/clear-local-history'
export type { ShadowSweepApiResult } from '@/frontend/lib/api/shadow-sweep'
export { postShadowSweep } from '@/frontend/lib/api/shadow-sweep'

export { setBossRole, sendBossCommand, transferCoins } from '@/frontend/lib/api/boss-transfer'

export {
  downloadStandaloneSmartphoneHandoffZip,
  type StandaloneSmartphoneHandoffZipBody,
  type StandaloneHandoffPackageSource,
} from '@/frontend/lib/api/standalone-smartphone-handoff'

export {
  applyHandoffEnvImport,
  previewHandoffEnvImport,
  type HandoffImportSummary,
} from '@/frontend/lib/api/handoff-env-import'

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

export type { TelegramIntegrationPublic } from '@/frontend/lib/api/telegram-integrations'
export {
  fetchTelegramIntegration,
  saveTelegramIntegration,
  testTelegramAlarm,
} from '@/frontend/lib/api/telegram-integrations'

export { notifyTelegramContact, testTelegramNotify } from '@/frontend/lib/api/telegram-notify'

export {
  loadAttestationQueue,
  saveAttestationQueue,
  enqueueAttestationManifestDraft,
  drainAttestationQueue,
  defaultAttestationSubmit,
  browserAttestationSubmit,
  buildAttestationManifestWire,
} from '@/frontend/lib/attestation-queue'
