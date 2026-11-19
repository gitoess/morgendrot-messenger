/**
 * Offene Zeitkapseln: LeaseCreated-Events → lokaler Index
 * (Shared Lease erscheint nicht unter getOwnedObjects).
 */

import { createDirectIotaClient } from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  MESSAGING_MODULES_PACKAGE_ID,
  MESSAGING_MODULES_PACKAGE_ID_P5,
  MESSAGING_MODULES_PACKAGE_ID_S1,
  MESSAGING_MODULES_PACKAGE_ID_S3,
} from '@/frontend/lib/messaging-modules-package'
import {
  dropPendingNftTimeLeasesForNft,
  upsertNftTimeLeaseLocal,
} from '@/frontend/lib/nft-time-lease-local-store'

const HEX64 = /^0x[a-f0-9]{64}$/

function asId(raw: unknown): string | null {
  if (typeof raw === 'string') {
    let t = raw.trim().toLowerCase()
    if (!t.startsWith('0x') && /^[a-f0-9]{64}$/.test(t)) t = `0x${t}`
    return HEX64.test(t) ? t : null
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    return asId(o.id ?? o.objectId ?? o.bytes ?? o.value)
  }
  return null
}

function asUnlockMs(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim())
  return 0
}

function knownLeasePackages(): string[] {
  return [
    ...new Set(
      [
        MESSAGING_MODULES_PACKAGE_ID,
        MESSAGING_MODULES_PACKAGE_ID_P5,
        MESSAGING_MODULES_PACKAGE_ID_S1,
        MESSAGING_MODULES_PACKAGE_ID_S3,
      ].map((p) => p.toLowerCase())
    ),
  ]
}

export type DiscoveredNftTimeLease = {
  leaseObjectId: string
  nftObjectId: string
  lender: string
  borrower: string
  unlockMs: number
  messagingPackageId: string
  createDigest?: string
}

/** LeaseCreated-Events, in denen `me` Lender oder Borrower ist. */
export async function discoverNftTimeLeasesFromEvents(
  meAddress?: string
): Promise<DiscoveredNftTimeLease[]> {
  const me = (meAddress || getDirectIotaSessionSignerAddress() || '').trim().toLowerCase()
  if (!HEX64.test(me)) return []
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return []
  const client = createDirectIotaClient({ rpcUrl: rpc })
  const out: DiscoveredNftTimeLease[] = []
  const seen = new Set<string>()

  for (const pkg of knownLeasePackages()) {
    try {
      const ev = await client.queryEvents({
        query: { MoveModule: { package: pkg, module: 'nft_time_lease' } },
        limit: 80,
        order: 'descending',
      })
      for (const e of ev.data || []) {
        const t = (e.type || '').toLowerCase()
        if (!t.includes('leasecreated')) continue
        const pj = (e.parsedJson || {}) as Record<string, unknown>
        const leaseObjectId = asId(pj.lease_id ?? pj.leaseId)
        const nftObjectId = asId(pj.nft_id ?? pj.nftId)
        const lender = asId(pj.lender) || asId(e.sender)
        const borrower = asId(pj.borrower)
        const unlockMs = asUnlockMs(pj.unlock_ms ?? pj.unlockMs)
        if (!leaseObjectId || !nftObjectId || !lender || !borrower) continue
        if (lender !== me && borrower !== me) continue
        if (seen.has(leaseObjectId)) continue
        seen.add(leaseObjectId)
        out.push({
          leaseObjectId,
          nftObjectId,
          lender,
          borrower,
          unlockMs,
          messagingPackageId: pkg,
          createDigest: typeof e.id?.txDigest === 'string' ? e.id.txDigest : undefined,
        })
      }
    } catch {
      /* Package/Modul fehlt auf dieser Version */
    }
  }
  return out
}

/**
 * Events → lokaler Index. Optional: Objekt noch auf Chain prüfen
 * (nach Reclaim existiert das Shared-Lease nicht mehr).
 */
export async function syncDiscoveredNftTimeLeasesIntoLocalIndex(): Promise<{
  ok: true
  found: number
  active: number
} | { ok: false; error: string }> {
  try {
    const me = getDirectIotaSessionSignerAddress()
    if (!me) return { ok: false, error: 'Kein Session-Signer — Tresor entsperren.' }
    const found = await discoverNftTimeLeasesFromEvents(me)
    if (found.length === 0) return { ok: true, found: 0, active: 0 }

    const rpc = getConfiguredDirectIotaRpcUrl()
    const client = rpc ? createDirectIotaClient({ rpcUrl: rpc }) : null
    let active = 0

    for (const d of found) {
      dropPendingNftTimeLeasesForNft(d.nftObjectId)
      if (client) {
        try {
          const res = await client.getObject({
            id: d.leaseObjectId,
            options: { showContent: true, showType: true },
          })
          const typ = String(
            (res.data?.content as { type?: string } | undefined)?.type || res.data?.type || ''
          )
          if (!res.data || res.error || !typ.includes('nft_time_lease::NftTimeLease')) {
            upsertNftTimeLeaseLocal({
              leaseObjectId: d.leaseObjectId,
              nftObjectId: d.nftObjectId,
              lender: d.lender,
              borrower: d.borrower,
              unlockMs: d.unlockMs,
              reclaimCancelled: false,
              status: 'reclaimed',
              createDigest: d.createDigest,
              messagingPackageId: d.messagingPackageId,
            })
            continue
          }
          const f = (res.data.content as { fields?: Record<string, unknown> } | undefined)?.fields
          const unlock = asUnlockMs(f?.unlock_ms ?? f?.unlockMs)
          const cancelled = Boolean(f?.reclaim_cancelled ?? f?.reclaimCancelled)
          upsertNftTimeLeaseLocal({
            leaseObjectId: d.leaseObjectId,
            nftObjectId: d.nftObjectId,
            lender: asId(f?.lender) || d.lender,
            borrower: asId(f?.borrower) || d.borrower,
            unlockMs: unlock > 0 ? unlock : d.unlockMs,
            reclaimCancelled: cancelled,
            status: cancelled ? 'cancelled' : 'active',
            createDigest: d.createDigest,
            messagingPackageId: d.messagingPackageId,
          })
          if (!cancelled) active += 1
          continue
        } catch {
          /* Event reicht als Fallback */
        }
      }
      upsertNftTimeLeaseLocal({
        leaseObjectId: d.leaseObjectId,
        nftObjectId: d.nftObjectId,
        lender: d.lender,
        borrower: d.borrower,
        unlockMs: d.unlockMs,
        reclaimCancelled: false,
        status: 'active',
        createDigest: d.createDigest,
        messagingPackageId: d.messagingPackageId,
      })
      active += 1
    }
    return { ok: true, found: found.length, active }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
