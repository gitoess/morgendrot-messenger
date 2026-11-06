/**
 * B2-P5b — create / cancel / return_early / reclaim signieren + lokalen Index pflegen.
 */

import {
  attachGasPaymentForOwner,
  createDirectIotaClient,
  isDirectChainExecutionSuccess,
  signAndExecuteTransactionWithSigner,
} from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'
import {
  getDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import {
  buildCancelNftTimeLeaseReclaimTransaction,
  buildCreateNftTimeLeaseTransaction,
  buildReclaimNftTimeLeaseTransaction,
  buildReturnEarlyNftTimeLeaseTransaction,
} from '@/frontend/lib/nft-time-lease-txb'
import {
  patchNftTimeLeaseLocal,
  upsertNftTimeLeaseLocal,
} from '@/frontend/lib/nft-time-lease-local-store'

export type NftTimeLeaseActionResult =
  | { ok: true; digest: string; leaseObjectId?: string }
  | { ok: false; error: string }

const GAS_BUDGET = 50_000_000n
const HEX64 = /^0x[a-f0-9]{64}$/

async function prepare(): Promise<
  | {
      ok: true
      client: ReturnType<typeof createDirectIotaClient>
      signer: NonNullable<ReturnType<typeof getDirectIotaSessionSigner>>
      sender: string
    }
  | { ok: false; error: string }
> {
  if (isIotaRelayOnlyMode()) {
    return { ok: false, error: 'Braucht Direkt-RPC (nicht „Nur Morgendrot-API“).' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  const signer = getDirectIotaSessionSigner()
  const sender = getDirectIotaSessionSignerAddress()
  if (!signer || !sender) {
    return { ok: false, error: 'Kein Session-Signer — Vault entsperren.' }
  }
  return { ok: true, client: createDirectIotaClient({ rpcUrl: rpc }), signer, sender }
}

/** Lease-Object-ID aus create_lease Effects (created shared). */
function pickCreatedLeaseId(effects: unknown): string | undefined {
  try {
    const e = effects as {
      created?: Array<{ reference?: { objectId?: string }; owner?: unknown }>
    }
    for (const c of e.created || []) {
      const id = c.reference?.objectId?.trim().toLowerCase()
      if (id && HEX64.test(id)) return id
    }
  } catch {
    /* ignore */
  }
  return undefined
}

export async function createNftTimeLease(input: {
  messagingPackageId: string
  nftObjectId: string
  borrowerAddress: string
  durationMs: number
  imageNftPackageId?: string
}): Promise<NftTimeLeaseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildCreateNftTimeLeaseTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      nftObjectId: input.nftObjectId,
      borrowerAddress: input.borrowerAddress,
      durationMs: input.durationMs,
      imageNftPackageId: input.imageNftPackageId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({
      client,
      transaction: txb,
      signer,
    })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return { ok: false, error: `create_lease fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.` }
    }
    let leaseObjectId: string | undefined
    try {
      const tx = await client.getTransactionBlock({
        digest: out.digest,
        options: { showEffects: true, showEvents: true },
      })
      leaseObjectId = pickCreatedLeaseId(tx.effects)
      if (!leaseObjectId) {
        const evs = (tx as { events?: Array<{ type?: string; parsedJson?: { lease_id?: string } }> }).events || []
        for (const ev of evs) {
          if (ev.type?.includes('::nft_time_lease::LeaseCreated') && ev.parsedJson?.lease_id) {
            const id = String(ev.parsedJson.lease_id).trim().toLowerCase()
            if (HEX64.test(id)) {
              leaseObjectId = id
              break
            }
          }
        }
      }
    } catch {
      /* Lease-ID manuell nachtragen */
    }
    if (leaseObjectId) {
      upsertNftTimeLeaseLocal({
        leaseObjectId,
        nftObjectId: input.nftObjectId,
        lender: sender,
        borrower: input.borrowerAddress,
        unlockMs: Date.now() + Math.max(1, Math.floor(input.durationMs)),
        reclaimCancelled: false,
        status: 'active',
      })
    }
    return { ok: true, digest: out.digest, leaseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function cancelNftTimeLeaseReclaim(input: {
  messagingPackageId: string
  leaseObjectId: string
}): Promise<NftTimeLeaseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildCancelNftTimeLeaseReclaimTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      leaseObjectId: input.leaseObjectId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return { ok: false, error: `cancel_reclaim fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.` }
    }
    patchNftTimeLeaseLocal(input.leaseObjectId, { reclaimCancelled: true, status: 'cancelled' })
    return { ok: true, digest: out.digest, leaseObjectId: input.leaseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function returnEarlyNftTimeLease(input: {
  messagingPackageId: string
  leaseObjectId: string
  imageNftPackageId?: string
}): Promise<NftTimeLeaseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildReturnEarlyNftTimeLeaseTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      leaseObjectId: input.leaseObjectId,
      imageNftPackageId: input.imageNftPackageId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return { ok: false, error: `return_early fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.` }
    }
    patchNftTimeLeaseLocal(input.leaseObjectId, { status: 'returned' })
    return { ok: true, digest: out.digest, leaseObjectId: input.leaseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function reclaimNftTimeLease(input: {
  messagingPackageId: string
  leaseObjectId: string
  imageNftPackageId?: string
}): Promise<NftTimeLeaseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildReclaimNftTimeLeaseTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      leaseObjectId: input.leaseObjectId,
      imageNftPackageId: input.imageNftPackageId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return { ok: false, error: `reclaim fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.` }
    }
    patchNftTimeLeaseLocal(input.leaseObjectId, { status: 'reclaimed' })
    return { ok: true, digest: out.digest, leaseObjectId: input.leaseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
