'use client'

import { readBossChainRegistryIds } from '@/frontend/lib/boss-chain-registry-store'
import type { HandoffExportRuntimeDefaults } from '@/frontend/lib/handoff-export-defaults'
import { getDirectChainFieldIdsFromLs } from '@/frontend/lib/direct-iota-chain-context'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

/** IDs/RPC aus Direct-Chain + Registry-localStorage (ohne Server). */
export function readHandoffCurrentIdsFromLocal(): Partial<HandoffExportRuntimeDefaults> {
  const chain = getDirectChainFieldIdsFromLs()
  const reg = readBossChainRegistryIds()
  const rpc = (getConfiguredDirectIotaRpcUrl() ?? '').trim()
  const out: Partial<HandoffExportRuntimeDefaults> = {}

  const mb = chain.mailboxId.trim()
  if (HEX64.test(mb)) {
    out.handoffMailbox = mb
    out.selectedTeamIds = [mb]
  }
  if (reg.commandRegistryId) out.handoffCmdReg = reg.commandRegistryId
  if (reg.vaultRegistryId) out.handoffVaultReg = reg.vaultRegistryId
  if (rpc) out.handoffRpc = rpc

  return out
}

export type HandoffCurrentIdsFields = {
  rpcUrl?: string
  mailboxId?: string
  commandRegistryId?: string
  vaultRegistryId?: string
}

export function handoffCurrentIdsFieldsFromPatch(
  patch: Partial<HandoffExportRuntimeDefaults>
): HandoffCurrentIdsFields {
  return {
    rpcUrl: patch.handoffRpc?.trim() || undefined,
    mailboxId: patch.handoffMailbox?.trim() || undefined,
    commandRegistryId: patch.handoffCmdReg?.trim() || undefined,
    vaultRegistryId: patch.handoffVaultReg?.trim() || undefined,
  }
}
