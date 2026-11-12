/**
 * On-chain Vault-Entdeckung ohne manuellen Digest:
 * - GuardedPurse: owned Objects der Session-Wallet
 * - Bearer Treasury: Create-Events (shared → nicht in getOwnedObjects)
 */

import { createDirectIotaClient } from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  MESSAGING_MODULES_PACKAGE_ID,
  MESSAGING_MODULES_PACKAGE_ID_S1,
  MESSAGING_MODULES_PACKAGE_ID_S3,
} from '@/frontend/lib/messaging-modules-package'
import { IOTA_COIN_TYPE, guardedPurseType } from '@/frontend/lib/nft-guarded-purse-txb'
import { upsertNftGuardedPurseLocal } from '@/frontend/lib/nft-guarded-purse-local-store'
import { upsertNftBearerTreasuryLocal } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { parseMistBalanceFromMoveContent } from '@/frontend/lib/nft-vault-balance'

const HEX64 = /^0x[a-f0-9]{64}$/

function asId(raw: unknown): string | null {
  const t = String(raw || '')
    .trim()
    .toLowerCase()
  return HEX64.test(t) ? t : null
}

function knownPackages(): string[] {
  return [
    ...new Set(
      [
        MESSAGING_MODULES_PACKAGE_ID,
        MESSAGING_MODULES_PACKAGE_ID_S1,
        MESSAGING_MODULES_PACKAGE_ID_S3,
      ].map((p) => p.toLowerCase())
    ),
  ]
}

export type DiscoveredVault = {
  kind: 'guarded' | 'bearer'
  vaultObjectId: string
  nftObjectId: string
  messagingPackageId: string
  balanceMistHint?: string
  ownerOrAdmin?: string
}

function mistHintFromContent(content: unknown): string | undefined {
  const mist = parseMistBalanceFromMoveContent(content)
  return mist != null ? mist.toString() : undefined
}

/** Guarded Purses in der eigenen Wallet (alle bekannten Package-Versionen). */
export async function discoverOwnedGuardedPurses(ownerAddress?: string): Promise<DiscoveredVault[]> {
  const owner = (ownerAddress || getDirectIotaSessionSignerAddress() || '').trim().toLowerCase()
  if (!HEX64.test(owner)) return []
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return []
  const client = createDirectIotaClient({ rpcUrl: rpc })
  const out: DiscoveredVault[] = []

  for (const pkg of knownPackages()) {
    const structType = guardedPurseType(pkg, IOTA_COIN_TYPE)
    let cursor: string | null | undefined = null
    for (let page = 0; page < 8; page++) {
      const res = await client.getOwnedObjects({
        owner,
        cursor: cursor || undefined,
        options: { showType: true, showContent: true },
        filter: { StructType: structType },
      })
      for (const row of res.data || []) {
        const id = asId(row.data?.objectId)
        if (!id) continue
        const content = row.data?.content
        const fields =
          content && typeof content === 'object' && 'fields' in content
            ? (content as { fields?: Record<string, unknown> }).fields
            : null
        const nftObjectId = asId(fields?.required_nft_id) || asId(fields?.required_nft)
        if (!nftObjectId) continue
        const ownerField = asId(fields?.owner) || owner
        out.push({
          kind: 'guarded',
          vaultObjectId: id,
          nftObjectId,
          messagingPackageId: pkg,
          balanceMistHint: mistHintFromContent(content),
          ownerOrAdmin: ownerField || undefined,
        })
      }
      if (!res.hasNextPage) break
      cursor = res.nextCursor || null
      if (!cursor) break
    }
  }
  return out
}

/**
 * Bearer Treasuries: Create-Events der eigenen Adresse (Admin).
 * Shared Objects erscheinen nicht unter getOwnedObjects.
 */
export async function discoverBearerTreasuriesFromEvents(
  adminAddress?: string
): Promise<DiscoveredVault[]> {
  const admin = (adminAddress || getDirectIotaSessionSignerAddress() || '').trim().toLowerCase()
  if (!HEX64.test(admin)) return []
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return []
  const client = createDirectIotaClient({ rpcUrl: rpc })
  const out: DiscoveredVault[] = []
  const seen = new Set<string>()

  for (const pkg of knownPackages()) {
    try {
      const ev = await client.queryEvents({
        query: { MoveModule: { package: pkg, module: 'nft_bearer_treasury' } },
        limit: 50,
        order: 'descending',
      })
      for (const e of ev.data || []) {
        const t = e.type || ''
        if (!t.includes('::TreasuryCreated')) continue
        const pj = (e.parsedJson || {}) as Record<string, unknown>
        const treasuryObjectId = asId(pj.treasury_id)
        const nftObjectId = asId(pj.required_nft_id)
        const evAdmin = asId(pj.admin) || asId(e.sender)
        if (!treasuryObjectId || !nftObjectId) continue
        if (evAdmin && evAdmin !== admin) continue
        if (seen.has(treasuryObjectId)) continue
        seen.add(treasuryObjectId)
        out.push({
          kind: 'bearer',
          vaultObjectId: treasuryObjectId,
          nftObjectId,
          messagingPackageId: pkg,
          balanceMistHint: pj.amount != null ? String(pj.amount) : undefined,
          ownerOrAdmin: evAdmin || admin,
        })
      }
    } catch {
      /* Package/Modul fehlt auf dieser Version */
    }
  }
  return out
}

/** Entdecken + lokalen Index upserten. */
export async function syncDiscoveredVaultsIntoLocalIndex(): Promise<{
  ok: true
  guarded: number
  bearer: number
} | { ok: false; error: string }> {
  try {
    const me = getDirectIotaSessionSignerAddress()
    if (!me) return { ok: false, error: 'Kein Session-Signer — Tresor entsperren.' }
    const [purses, treasuries] = await Promise.all([
      discoverOwnedGuardedPurses(me),
      discoverBearerTreasuriesFromEvents(me),
    ])
    for (const p of purses) {
      upsertNftGuardedPurseLocal({
        purseObjectId: p.vaultObjectId,
        nftObjectId: p.nftObjectId,
        owner: p.ownerOrAdmin || me,
        balanceMistHint: p.balanceMistHint || '?',
        status: 'active',
        messagingPackageId: p.messagingPackageId,
      })
    }
    for (const t of treasuries) {
      upsertNftBearerTreasuryLocal({
        treasuryObjectId: t.vaultObjectId,
        nftObjectId: t.nftObjectId,
        admin: t.ownerOrAdmin || me,
        balanceMistHint: t.balanceMistHint || '?',
        frozen: false,
        status: 'active',
        messagingPackageId: t.messagingPackageId,
      })
    }
    return { ok: true, guarded: purses.length, bearer: treasuries.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
