'use client'

/**
 * Boss-APK offline: Ketten-IDs + Signer für clientseitigen Handoff-Export (Weg A, Scheibe 1).
 * @see docs/BOSS-APK-HANDOFF-EXPORT-CHECKLIST.md
 */
import { getDirectChainFieldIdsFromLs, getDirectChainIdsReadiness } from '@/frontend/lib/direct-iota-chain-context'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { readPersistedEinsatzChainMode } from '@/frontend/lib/einsatz-chain-mode-local'
import { readBossChainRegistryIds } from '@/frontend/lib/boss-chain-registry-store'
import type { EinsatzChainMode } from '@morgendrot/shared/einsatz-chain-mode'

export type BossHandoffExportContext = {
  ready: boolean
  missing: string[]
  packageId: string
  mailboxId: string
  bossAddress: string
  rpcUrl: string
  directIotaRpcUrl: string
  commandRegistryId: string
  vaultRegistryId: string
  exportTtlDays: number
  exportEnablePurge: boolean
  einsatzChainMode: EinsatzChainMode
}

const ADDR = /^0x[a-fA-F0-9]{64}$/i

function resolveBossAddress(chainSender: string): string {
  const session = getDirectIotaSessionSignerAddress()?.trim() ?? ''
  if (ADDR.test(session)) return session.toLowerCase()
  const ls = chainSender.trim()
  if (ADDR.test(ls)) return ls.toLowerCase()
  return ''
}

/** Liest lokale Boss-Voraussetzungen für Handoff-Export ohne API. */
export function resolveBossHandoffExportContext(): BossHandoffExportContext {
  const readiness = getDirectChainIdsReadiness()
  const chain = getDirectChainFieldIdsFromLs()
  const rpcUrl = (getConfiguredDirectIotaRpcUrl() ?? '').trim()
  const bossAddress = resolveBossAddress(chain.senderAddress)
  const ttlN = Number(chain.ttlDays)
  const exportTtlDays =
    Number.isFinite(ttlN) && ttlN >= 0 && ttlN <= 3650 ? Math.floor(ttlN) : 30
  const einsatzChainMode = readPersistedEinsatzChainMode() ?? 'mainnet-direct'
  const reg = readBossChainRegistryIds()

  const missing = [...readiness.missing]
  if (!bossAddress) {
    if (!missing.includes('Absender (0x)')) missing.push('Boss-Wallet (Signer)')
  }

  return {
    ready: missing.length === 0 && Boolean(bossAddress),
    missing,
    packageId: chain.packageId.trim().toLowerCase(),
    mailboxId: chain.mailboxId.trim().toLowerCase(),
    bossAddress,
    rpcUrl,
    directIotaRpcUrl: rpcUrl,
    commandRegistryId: reg.commandRegistryId,
    vaultRegistryId: reg.vaultRegistryId,
    exportTtlDays,
    exportEnablePurge: true,
    einsatzChainMode,
  }
}
