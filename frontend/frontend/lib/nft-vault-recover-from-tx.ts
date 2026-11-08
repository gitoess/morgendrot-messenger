/**
 * Vault aus TX-Digest wiederherstellen (wenn lokaler Index fehlt).
 */

import { createDirectIotaClient } from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { recordNftVaultActivity } from '@/frontend/lib/iota-activity-local-log'
import {
  upsertNftBearerTreasuryLocal,
  type NftBearerTreasuryLocalEntry,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import {
  upsertNftGuardedPurseLocal,
  type NftGuardedPurseLocalEntry,
} from '@/frontend/lib/nft-guarded-purse-local-store'
import { bindVaultToNftKeycard, getNftKeycard } from '@/frontend/lib/nft-keycard-local-store'

const HEX64 = /^0x[a-f0-9]{64}$/

export type RecoveredVault =
  | {
      kind: 'bearer'
      treasuryObjectId: string
      nftObjectId: string
      amountMist: string
      admin: string
      messagingPackageId: string
      digest: string
    }
  | {
      kind: 'guarded'
      purseObjectId: string
      nftObjectId: string
      amountMist: string
      owner: string
      messagingPackageId: string
      digest: string
    }

function asId(raw: unknown): string | null {
  const t = String(raw || '')
    .trim()
    .toLowerCase()
  return HEX64.test(t) ? t : null
}

/** Events + objectChanges → Vault-Metadaten. */
export function parseVaultFromTxPayload(input: {
  digest: string
  events?: unknown
  objectChanges?: unknown
  sender?: string
}): RecoveredVault | null {
  const digest = input.digest.trim()
  const evs = (Array.isArray(input.events) ? input.events : []) as Array<{
    type?: string
    packageId?: string
    parsedJson?: Record<string, unknown>
    sender?: string
  }>

  for (const ev of evs) {
    const t = ev.type || ''
    const pj = ev.parsedJson || {}
    const pkg = asId(ev.packageId) || ''
    if (t.includes('::nft_bearer_treasury::TreasuryCreated')) {
      const treasuryObjectId = asId(pj.treasury_id)
      const nftObjectId = asId(pj.required_nft_id)
      const admin = asId(pj.admin) || asId(ev.sender) || asId(input.sender) || ''
      if (treasuryObjectId && nftObjectId) {
        return {
          kind: 'bearer',
          treasuryObjectId,
          nftObjectId,
          amountMist: String(pj.amount ?? '0'),
          admin: admin || '0x' + '00'.repeat(32),
          messagingPackageId: pkg,
          digest,
        }
      }
    }
    if (t.includes('::nft_guarded_purse::PurseCreated')) {
      const purseObjectId = asId(pj.purse_id)
      const nftObjectId = asId(pj.required_nft_id)
      const owner = asId(pj.owner) || asId(ev.sender) || asId(input.sender) || ''
      if (purseObjectId && nftObjectId) {
        return {
          kind: 'guarded',
          purseObjectId,
          nftObjectId,
          amountMist: String(pj.amount ?? '0'),
          owner: owner || '0x' + '00'.repeat(32),
          messagingPackageId: pkg,
          digest,
        }
      }
    }
  }

  const changes = (Array.isArray(input.objectChanges) ? input.objectChanges : []) as Array<{
    type?: string
    objectType?: string
    objectId?: string
    sender?: string
  }>
  for (const c of changes) {
    if (c.type !== 'created') continue
    const ot = c.objectType || ''
    const oid = asId(c.objectId)
    if (!oid) continue
    if (ot.includes('::nft_bearer_treasury::NftGuardedTreasury')) {
      const pkgMatch = ot.match(/^(0x[a-f0-9]{64})::/i)
      return {
        kind: 'bearer',
        treasuryObjectId: oid,
        nftObjectId: '0x' + '00'.repeat(32),
        amountMist: '0',
        admin: asId(c.sender) || asId(input.sender) || '0x' + '00'.repeat(32),
        messagingPackageId: pkgMatch?.[1]?.toLowerCase() || '',
        digest,
      }
    }
    if (ot.includes('::nft_guarded_purse::GuardedPurse')) {
      const pkgMatch = ot.match(/^(0x[a-f0-9]{64})::/i)
      return {
        kind: 'guarded',
        purseObjectId: oid,
        nftObjectId: '0x' + '00'.repeat(32),
        amountMist: '0',
        owner: asId(c.sender) || asId(input.sender) || '0x' + '00'.repeat(32),
        messagingPackageId: pkgMatch?.[1]?.toLowerCase() || '',
        digest,
      }
    }
  }
  return null
}

export function applyRecoveredVaultLocal(
  v: RecoveredVault
): { ok: true; entry: NftBearerTreasuryLocalEntry | NftGuardedPurseLocalEntry } | { ok: false; error: string } {
  const label = getNftKeycard(v.nftObjectId)?.label
  if (v.kind === 'bearer') {
    if (!HEX64.test(v.nftObjectId) || v.nftObjectId === '0x' + '00'.repeat(32)) {
      return {
        ok: false,
        error:
          'Treasury gefunden, aber NFT-ID fehlt im TX-Event — Object-ID der Schlüsselkarte manuell nachtragen.',
      }
    }
    const entry: Omit<NftBearerTreasuryLocalEntry, 'updatedAtMs'> = {
      treasuryObjectId: v.treasuryObjectId,
      nftObjectId: v.nftObjectId,
      admin: v.admin,
      balanceMistHint: v.amountMist,
      frozen: false,
      status: 'active',
      createDigest: v.digest,
      ...(label ? { displayLabel: label } : {}),
      ...(v.messagingPackageId ? { messagingPackageId: v.messagingPackageId } : {}),
    }
    upsertNftBearerTreasuryLocal(entry)
    bindVaultToNftKeycard({
      objectId: v.nftObjectId,
      vault: {
        kind: 'bearer',
        vaultObjectId: v.treasuryObjectId,
        messagingPackageId: v.messagingPackageId,
        createDigest: v.digest,
      },
    })
    recordNftVaultActivity({
      op: 'treasury_create',
      vaultObjectId: v.treasuryObjectId,
      nftObjectId: v.nftObjectId,
      amountMist: v.amountMist,
      digest: v.digest,
      nftLabel: label,
    })
    return {
      ok: true,
      entry: { ...entry, updatedAtMs: Date.now() },
    }
  }
  if (!HEX64.test(v.nftObjectId) || v.nftObjectId === '0x' + '00'.repeat(32)) {
    return {
      ok: false,
      error: 'Purse gefunden, aber NFT-ID fehlt — Schlüsselkarten-Object-ID manuell nachtragen.',
    }
  }
  const entry: Omit<NftGuardedPurseLocalEntry, 'updatedAtMs'> = {
    purseObjectId: v.purseObjectId,
    nftObjectId: v.nftObjectId,
    owner: v.owner,
    balanceMistHint: v.amountMist,
    status: 'active',
    createDigest: v.digest,
    ...(label ? { displayLabel: label } : {}),
    ...(v.messagingPackageId ? { messagingPackageId: v.messagingPackageId } : {}),
  }
  upsertNftGuardedPurseLocal(entry)
  bindVaultToNftKeycard({
    objectId: v.nftObjectId,
    vault: {
      kind: 'guarded',
      vaultObjectId: v.purseObjectId,
      messagingPackageId: v.messagingPackageId,
      createDigest: v.digest,
    },
  })
  recordNftVaultActivity({
    op: 'purse_create',
    vaultObjectId: v.purseObjectId,
    nftObjectId: v.nftObjectId,
    amountMist: v.amountMist,
    digest: v.digest,
    nftLabel: label,
  })
  return { ok: true, entry: { ...entry, updatedAtMs: Date.now() } }
}

export async function recoverNftVaultFromDigest(
  digestRaw: string
): Promise<
  | { ok: true; vault: RecoveredVault }
  | { ok: false; error: string }
> {
  const digest = digestRaw.trim()
  if (!digest || digest.length < 20) {
    return { ok: false, error: 'TX-Digest fehlt oder ist zu kurz.' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const tx = await client.getTransactionBlock({
      digest,
      options: { showEvents: true, showObjectChanges: true, showEffects: true },
    })
    const sender =
      typeof (tx as { transaction?: { data?: { sender?: string } } }).transaction?.data?.sender ===
      'string'
        ? (tx as { transaction?: { data?: { sender?: string } } }).transaction?.data?.sender
        : undefined
    const vault = parseVaultFromTxPayload({
      digest,
      events: (tx as { events?: unknown }).events,
      objectChanges: (tx as { objectChanges?: unknown }).objectChanges,
      sender,
    })
    if (!vault) {
      return {
        ok: false,
        error: 'Keine Purse-/Treasury-Create-Events in dieser TX.',
      }
    }
    const applied = applyRecoveredVaultLocal(vault)
    if (!applied.ok) return applied
    return { ok: true, vault }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
