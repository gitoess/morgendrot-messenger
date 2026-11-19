/**
 * Wenn Chain-Balance 0: destroy_empty + lokalen Index räumen → NFT wieder frei.
 */

import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'
import { destroyEmptyNftBearerTreasury } from '@/frontend/lib/nft-bearer-treasury-actions'
import { findNftBearerTreasuryById } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { destroyEmptyNftGuardedPurse } from '@/frontend/lib/nft-guarded-purse-actions'
import { findNftGuardedPurseById } from '@/frontend/lib/nft-guarded-purse-local-store'

export type AutoDestroyEmptyResult =
  | { status: 'skipped'; reason: 'nonzero' | 'no-local-vault' }
  | { status: 'destroyed'; kind: 'guarded' | 'bearer'; digest?: string }
  | { status: 'failed'; error: string }

export async function autoDestroyEmptyNftVault(opts: {
  vaultObjectId: string
  mist: bigint
  fallbackPackageId?: string
}): Promise<AutoDestroyEmptyResult> {
  if (opts.mist !== 0n) return { status: 'skipped', reason: 'nonzero' }
  const vaultId = opts.vaultObjectId.trim().toLowerCase()
  if (!vaultId) return { status: 'skipped', reason: 'no-local-vault' }

  const purse = findNftGuardedPurseById(vaultId)
  const treasury = findNftBearerTreasuryById(vaultId)
  if (!purse && !treasury) return { status: 'skipped', reason: 'no-local-vault' }

  const pkg =
    (purse?.messagingPackageId || treasury?.messagingPackageId || opts.fallbackPackageId || '').trim() ||
    MESSAGING_MODULES_PACKAGE_ID

  if (purse) {
    const r = await destroyEmptyNftGuardedPurse({
      messagingPackageId: pkg,
      purseObjectId: vaultId,
    })
    if (!r.ok) return { status: 'failed', error: r.error || 'destroy_empty (Guarded) fehlgeschlagen.' }
    return { status: 'destroyed', kind: 'guarded', digest: r.digest }
  }

  const r = await destroyEmptyNftBearerTreasury({
    messagingPackageId: pkg,
    treasuryObjectId: vaultId,
  })
  if (!r.ok) return { status: 'failed', error: r.error || 'destroy_empty (Bearer) fehlgeschlagen.' }
  return { status: 'destroyed', kind: 'bearer', digest: r.digest }
}
