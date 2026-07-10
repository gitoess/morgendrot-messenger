'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import { getApiBase } from '@/frontend/lib/api/api-base'
import { fetchWithApiAuth } from '@/frontend/lib/api-authenticated-fetch'
import { persistBossChainRegistryIds } from '@/frontend/lib/boss-chain-registry-store'
import { persistDirectChainFieldIds } from '@/frontend/lib/direct-iota-chain-context'

export type BossRegistryBootstrapResult = {
  ok: boolean
  message?: string
  error?: string
  packageId?: string
  mailboxId?: string
  vaultRegistryId?: string
  commandRegistryId?: string
}

const PKG_RE = /^0x[a-fA-F0-9]{64}$/i

export function bossRegistryStatus(api?: ApiStatus | null): {
  hasPackage: boolean
  hasMailbox: boolean
  hasVaultRegistry: boolean
  hasCommandRegistry: boolean
  needsBootstrap: boolean
} {
  const hasPackage = PKG_RE.test(api?.packageId?.trim() ?? '')
  const hasMailbox = PKG_RE.test(api?.mailboxId?.trim() ?? '')
  const vaultRaw = api?.einsatzConfig?.vaultRegistryId?.trim() ?? ''
  const cmdRaw = api?.einsatzConfig?.commandRegistryId?.trim() ?? ''
  const hasVaultRegistry = PKG_RE.test(vaultRaw)
  const hasCommandRegistry = PKG_RE.test(cmdRaw)
  const needsBootstrap = hasPackage && (!hasMailbox || !hasVaultRegistry || !hasCommandRegistry)
  return { hasPackage, hasMailbox, hasVaultRegistry, hasCommandRegistry, needsBootstrap }
}

/** POST /api/create-globals — einmal pro PACKAGE_ID (IOTA-CLI auf Boss-PC). */
export async function createBossGlobalsRegistries(opts?: {
  packageId?: string
  force?: boolean
}): Promise<BossRegistryBootstrapResult> {
  const base = getApiBase().trim()
  if (!base) {
    return { ok: false, error: 'create_globals braucht erreichbares Backend (Boss-PC mit IOTA-CLI).' }
  }
  try {
    const res = await fetchWithApiAuth(`${base}/api/create-globals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageId: opts?.packageId?.trim() || undefined,
        force: opts?.force === true,
      }),
    })
    const body = (await res.json()) as BossRegistryBootstrapResult & { error?: string }
    if (!body.ok) {
      return { ok: false, error: body.error || 'create_globals fehlgeschlagen.' }
    }
    if (body.mailboxId) persistDirectChainFieldIds({ mailboxId: body.mailboxId.trim() })
    persistBossChainRegistryIds({
      commandRegistryId: body.commandRegistryId,
      vaultRegistryId: body.vaultRegistryId,
    })
    return {
      ok: true,
      message: body.message,
      packageId: body.packageId,
      mailboxId: body.mailboxId,
      vaultRegistryId: body.vaultRegistryId,
      commandRegistryId: body.commandRegistryId,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'create_globals fehlgeschlagen.' }
  }
}
