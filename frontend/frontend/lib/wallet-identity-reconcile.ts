'use client'

/**
 * Server MY_ADDRESS (.env / Tresor) ist die Identität — Browser-Signer und LS-Snapshot
 * dürfen sie nicht überschreiben (Feldtest ↔ Boss-Mix auf localhost:3341).
 */
import { syncActiveNetworkChainSnapshot } from '@/frontend/lib/active-network-chain-sync'
import { getDirectChainFieldIdsFromLs } from '@/frontend/lib/direct-iota-chain-context'
import { directIotaSignerMatchesIdentity } from '@/frontend/lib/direct-iota-signer-identity'
import {
  clearDirectIotaSessionSigner,
  clearDirectIotaSessionSignerTabSession,
  getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'

const WALLET_RE = /^0x[a-f0-9]{64}$/i

export function normalizeWalletIdentity(addr: string | null | undefined): string {
  return (addr ?? '').trim().toLowerCase()
}

export function isValidWalletIdentity(addr: string | null | undefined): boolean {
  return WALLET_RE.test((addr ?? '').trim())
}

export type WalletIdentityReconcileResult = {
  clearedBrowserSigner: boolean
  updatedChainSender: boolean
}

/** Abgleich nach GET /api/status — vor Auto-Restore des Session-Signers. */
export function reconcileWalletIdentityWithServer(
  serverMyAddress: string | null | undefined
): WalletIdentityReconcileResult {
  const result: WalletIdentityReconcileResult = {
    clearedBrowserSigner: false,
    updatedChainSender: false,
  }
  const server = (serverMyAddress ?? '').trim()
  if (!isValidWalletIdentity(server)) return result

  const browser = getDirectIotaSessionSignerAddress()?.trim()
  if (browser && !directIotaSignerMatchesIdentity(browser, server)) {
    clearDirectIotaSessionSigner()
    clearDirectIotaSessionSignerTabSession()
    result.clearedBrowserSigner = true
  }

  const lsSender = getDirectChainFieldIdsFromLs().senderAddress.trim()
  if (lsSender && normalizeWalletIdentity(lsSender) !== normalizeWalletIdentity(server)) {
    syncActiveNetworkChainSnapshot(server)
    result.updatedChainSender = true
  }

  return result
}

/** Tab-/RAM-Signer nur wiederherstellen, wenn er zur Server-Identität passt. */
export function sessionSignerMatchesServerIdentity(
  signerAddress: string,
  serverMyAddress: string | null | undefined
): boolean {
  const server = (serverMyAddress ?? '').trim()
  if (!isValidWalletIdentity(server)) return true
  return directIotaSignerMatchesIdentity(signerAddress, server)
}
