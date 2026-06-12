import type { StatusPollClockHint } from '@/frontend/lib/device-time-trust'
import type { MessengerCapabilitiesMatrix } from '@morgendrot/shared/messenger-capabilities-matrix'

/** Rechte aus getHierarchyPermissions (nur bei role boss/kommandant/arbeiter). */
export type HierarchyPermissions = {
  commandDown?: boolean
  keyIssue?: boolean
  revokeDown?: boolean
  statusReadDown?: boolean
  statusReadUp?: boolean
  configChange?: boolean
  hierarchyChange?: boolean
  teamManage?: boolean
}

/** Tresor-Status aus GET /api/status (Punkt 5 Marktreife: Listen-Ansicht + Sync-Status). */
export type VaultStatus = {
  hasLocal: boolean
  lastSavedToChainAt?: number
}

/** Backend-Status (GET /api/status): backendRunning, locked, connected, role, roleId, vaultStatus, … */
export type ApiStatus = {
  backendRunning?: boolean
  backendOnline?: boolean
  fromCache?: boolean
  fromLocalHandoff?: boolean
  cacheSavedAtMs?: number
  locked?: boolean
  connected?: boolean
  hasKeys?: boolean
  network?: string
  myAddress?: string
  role?: string
  roleId?: number
  capabilities?: MessengerCapabilitiesMatrix
  permissions?: HierarchyPermissions
  vaultStatus?: VaultStatus
  plaintextMode?: boolean
  useMailbox?: boolean
  mailboxConfigured?: boolean
  mailboxId?: string
  mailboxIdMasked?: string
  inboxUnionPackageIds?: string[]
  inboxUnionMailboxIds?: string[]
  mailboxStorePlaintext?: boolean
  messengerEdition?: 'standalone' | 'sales'
  messengerCreditsConfigured?: boolean
  messengerCredits?: { balance: string; maxBalance: string } | null
  messengerCreditsFetchFailed?: boolean
  configHints?: string[]
  rpcUrlLabel?: string
  packageId?: string
  apiListenPort?: number
  dashboardPort?: number
  compactImageEncode?: boolean
  loraProgressiveEncode?: boolean
  signer?: string
  signerConfigSource?: 'env' | 'runtime'
  walletDerivationPathConfigSource?: 'env' | 'runtime'
  useMailboxConfigSource?: 'env' | 'runtime'
  mailboxStorePlaintextConfigSource?: 'env' | 'runtime'
  enablePlaintextChannelConfigSource?: 'env' | 'runtime'
  runtimeConfigKeys?: string[]
  uiVariant?: 'full' | 'messenger'
  handoffLabel?: string
  /** Anzeigename (Boss/Profil) — optional aus Status. */
  displayName?: string
  deploymentProfile?: 'consumer' | 'einsatz'
  transportProfile?: 'mesh-first' | 'iota-anchored' | 'iota-full'
  simpleMode?: boolean
  uiMode?: 'simple' | 'expert'
  iotaTransportUiEnabled?: boolean
  serveLiteUiStatic?: boolean
  rpcSocksProxyActive?: boolean
  rpcHttpProxyActive?: boolean
  connectedAddresses?: string[]
  partnerAddress?: string
  partnerCount?: number
  streams?: { active: boolean; anchorId?: string; anchorIdFull?: string }
  heartbeat?: {
    enabled: boolean
    intervalMs: number
    streamsReady: boolean
    presetsMinutes?: number[]
    intervalMatchesPreset?: boolean
  }
  myAddressFull?: string
  walletNativeIotaBalance?: { mist: string; displayIota: string } | null
  walletNativeIotaBalanceFetchFailed?: boolean
  broadcastPinnwand?: {
    enabled: boolean
    address?: string
    authorizedSenders?: string[]
    myAddressAuthorized?: boolean
  }
  einsatzConfig?: {
    editionLabel: string
    defaultTtlDays: number
    enablePurge: boolean
    vaultRegistryId?: string
    vaultRegistryIdMasked?: string
    commandRegistryId?: string
    commandRegistryIdMasked?: string
    einsatzManifestRegistryId?: string
    einsatzManifestRegistryIdMasked?: string
    mainnetRpcUrlLabel?: string
    mainnetRpcUrl?: string
    mainnetPackageId?: string
    mainnetPackageIdMasked?: string
    moveFeatures?: {
      teamBroadcastStore: boolean
      teamBroadcastPurge: boolean
      privateMailboxPurge: boolean
      probed: boolean
      error?: string
    }
    upgradeCapConfigured?: boolean
    upgradeCapId?: string
    upgradeCapIdMasked?: string
    upgradeCapResolvedFromChain?: boolean
    deployModeHint?: string
  }
}

export type ApiStatusFetchOk = ApiStatus & { pollClockHint: StatusPollClockHint }

export type ApiStatusFetchResult = ApiStatusFetchOk | (ApiStatus & { error: string; backendRunning?: boolean })
