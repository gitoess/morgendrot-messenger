'use client'

import { getDirectChainFieldIdsFromLs } from '@/frontend/lib/direct-iota-chain-context'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { shouldPreferStandaloneHandoffStatus } from '@/frontend/lib/standalone-device-mode'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { probeBrowserDirectIotaIfConfigured } from '@/frontend/lib/direct-iota-rpc'

/** Einstellungen/Dashboard: lokale Handoff-Ketten-IDs wenn keine Basis-API. */
export function readStandaloneLocalIdentitySnapshot(): {
  packageId: string
  mailboxId: string
  myAddress: string
  rpcUrl: string
  handoffLabel?: string
} {
  const chain = getDirectChainFieldIdsFromLs()
  const handoff = readLocalHandoffAppliedSnapshot()
  const sessionAddr = getDirectIotaSessionSignerAddress()
  return {
    packageId: chain.packageId || handoff?.packageId || '',
    mailboxId: chain.mailboxId || handoff?.mailboxId || '',
    myAddress: sessionAddr || chain.senderAddress || '',
    rpcUrl: getConfiguredDirectIotaRpcUrl() || '',
    handoffLabel: handoff?.handoffLabel,
  }
}

export async function checkStandaloneChainReachable(): Promise<boolean | null> {
  if (!shouldPreferStandaloneHandoffStatus()) return null
  if (!getConfiguredDirectIotaRpcUrl()) return false
  try {
    return await probeBrowserDirectIotaIfConfigured()
  } catch {
    return false
  }
}

export async function getStandaloneCurrentIds(): Promise<{
  ok: boolean
  myAddress?: string
  packageId?: string
  mailboxId?: string
} | null> {
  if (!shouldPreferStandaloneHandoffStatus()) return null
  const snap = readStandaloneLocalIdentitySnapshot()
  return {
    ok: true,
    myAddress: snap.myAddress || undefined,
    packageId: snap.packageId || undefined,
    mailboxId: snap.mailboxId || undefined,
  }
}
