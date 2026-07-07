'use client'

/**
 * Privat/Solo: Fullnode, Package-ID und Mailbox-ID nach Wallet-Setup.
 */
import type { ApiStatus } from '@/frontend/lib/api/status'
import {
  getDirectChainFieldIdsFromLs,
  persistDirectChainFieldIds,
  persistDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { getConfiguredDirectIotaRpcUrl, sanitizeDirectIotaRpcUrl, setBrowserDirectIotaRpcUrlOverride } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  getStandaloneHelperReadiness,
  notifyStandaloneWalletActivated,
} from '@/frontend/lib/handoff-standalone-ready'
import {
  readLocalHandoffAppliedSnapshot,
  saveLocalHandoffAppliedSnapshot,
} from '@/frontend/lib/handoff-local-apply'
import { isStandaloneSoloPath } from '@/frontend/lib/standalone-onboarding'
import { isLikelyIotaHexId } from '@morgendrot/core/iota'
import { syncActiveNetworkChainSnapshot } from '@/frontend/lib/active-network-chain-sync'
import {
  readNetworkProfilesState,
  writeNetworkProfilesState,
  type EinsatzNetworkProfilesState,
} from '@/frontend/lib/einsatz-network-profiles'
import {
  buildLabDualNetworkProfilesState,
  labTestnetChainForSoloForm,
  LAB_TESTNET_CHAIN,
} from '@/frontend/lib/morgendrot-lab-chain-profiles'

export const SOLO_TESTNET_RPC_URL = LAB_TESTNET_CHAIN.rpcUrl

export type StandaloneSoloChainFormValues = {
  rpcUrl: string
  packageId: string
  mailboxId: string
}

export type StandaloneSoloChainApplyError =
  | 'invalidRpc'
  | 'invalidPackageId'
  | 'invalidMailboxId'
  | 'missingSigner'

export function getStandaloneSoloChainDefaults(): StandaloneSoloChainFormValues {
  const lab = labTestnetChainForSoloForm()
  return { rpcUrl: lab.rpcUrl, packageId: lab.packageId, mailboxId: lab.mailboxId }
}

/** Testnet aus Formular + Mainnet-Lab-Vorlage — für Solo und Smoke-Skripte. */
export function buildStandaloneSoloNetworkProfilesState(
  testnet: StandaloneSoloChainFormValues,
  senderAddress?: string
): EinsatzNetworkProfilesState {
  return buildLabDualNetworkProfilesState(
    {
      rpcUrl: testnet.rpcUrl.trim(),
      packageId: testnet.packageId.trim(),
      mailboxId: testnet.mailboxId.trim(),
    },
    senderAddress
  )
}

export function persistStandaloneSoloNetworkProfiles(
  testnet: StandaloneSoloChainFormValues,
  senderAddress: string
): EinsatzNetworkProfilesState {
  const prev = readNetworkProfilesState()
  const next = buildStandaloneSoloNetworkProfilesState(testnet, senderAddress)
  // Mainnet manuell gesetzt? Nicht mit Lab-Template überschreiben.
  if (
    prev.mainnet.packageId.trim() &&
    prev.mainnet.packageId.trim().toLowerCase() !== next.mainnet.packageId.trim().toLowerCase()
  ) {
    next.mainnet = { ...prev.mainnet }
  }
  if (
    prev.mainnet.mailboxId.trim() &&
    prev.mainnet.mailboxId.trim().toLowerCase() !== next.mainnet.mailboxId.trim().toLowerCase()
  ) {
    next.mainnet.mailboxId = prev.mainnet.mailboxId.trim()
  }
  if (prev.mainnet.rpcUrl.trim() && prev.mainnet.rpcUrl.trim() !== next.mainnet.rpcUrl) {
    next.mainnet.rpcUrl = prev.mainnet.rpcUrl.trim()
  }
  writeNetworkProfilesState(next)
  syncActiveNetworkChainSnapshot(senderAddress)
  return next
}

export function readStandaloneSoloChainFormValues(): StandaloneSoloChainFormValues {
  const defaults = getStandaloneSoloChainDefaults()
  const fields = getDirectChainFieldIdsFromLs()
  return {
    rpcUrl: getConfiguredDirectIotaRpcUrl() ?? defaults.rpcUrl,
    packageId: fields.packageId || defaults.packageId,
    mailboxId: fields.mailboxId || defaults.mailboxId,
  }
}

export function pickSoloChainPrefillFromApiStatus(
  status: ApiStatus | null | undefined
): Partial<StandaloneSoloChainFormValues> {
  if (!status) return {}
  const out: Partial<StandaloneSoloChainFormValues> = {}
  const pkg = String(status.packageId || '').trim()
  const mb = String(status.mailboxId || '').trim()
  if (isLikelyIotaHexId(pkg)) out.packageId = pkg
  if (isLikelyIotaHexId(mb)) out.mailboxId = mb
  const label = String(status.rpcUrlLabel || '').trim()
  if (label.startsWith('http://') || label.startsWith('https://')) out.rpcUrl = label
  return out
}

/** Wallet aktiv, Ketten-IDs oder RPC fehlen noch. */
export function needsStandaloneSoloChainWizard(): boolean {
  if (!isStandaloneSoloPath()) return false
  const r = getStandaloneHelperReadiness()
  if (!r.standaloneMode || !r.hasHandoff || r.needsMnemonic) return false
  return !r.readyForChat
}

export function applyStandaloneSoloChainConfig(
  input: StandaloneSoloChainFormValues
): { ok: true } | { ok: false; error: StandaloneSoloChainApplyError } {
  let rpcUrl: string
  try {
    rpcUrl = sanitizeDirectIotaRpcUrl(input.rpcUrl.trim())
  } catch {
    return { ok: false, error: 'invalidRpc' }
  }

  const packageId = input.packageId.trim()
  const mailboxId = input.mailboxId.trim()
  if (!isLikelyIotaHexId(packageId)) return { ok: false, error: 'invalidPackageId' }
  if (!isLikelyIotaHexId(mailboxId)) return { ok: false, error: 'invalidMailboxId' }

  const senderAddress = getDirectIotaSessionSignerAddress()?.trim() ?? ''
  if (!isLikelyIotaHexId(senderAddress)) return { ok: false, error: 'missingSigner' }

  setBrowserDirectIotaRpcUrlOverride(rpcUrl)
  persistDirectChainFieldIds({ packageId, mailboxId, senderAddress })

  const snapshot = readLocalHandoffAppliedSnapshot()
  if (snapshot) {
    saveLocalHandoffAppliedSnapshot({
      ...snapshot,
      packageId,
      mailboxId,
      savedAtMs: Date.now(),
    })
  }

  void persistDirectMailboxChainSnapshot({
    packageId,
    mailboxId,
    senderAddress,
    ttlDays: 30n,
    flags: {
      useMailbox: true,
      mailboxStorePlaintext: true,
      messengerCreditsConfigured: false,
    },
  })

  persistStandaloneSoloNetworkProfiles(
    { rpcUrl, packageId, mailboxId },
    senderAddress
  )

  notifyStandaloneWalletActivated()
  return { ok: true }
}
