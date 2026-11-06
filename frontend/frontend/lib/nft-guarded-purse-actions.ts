/**
 * B2-S2 — create / deposit / spend / destroy_empty signieren + lokalen Index pflegen.
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
  buildCreateGuardedPurseTransaction,
  buildDepositGuardedPurseTransaction,
  buildDestroyEmptyGuardedPurseTransaction,
  buildSpendGuardedPurseTransaction,
} from '@/frontend/lib/nft-guarded-purse-txb'
import {
  patchNftGuardedPurseLocal,
  removeNftGuardedPurseLocal,
  upsertNftGuardedPurseLocal,
} from '@/frontend/lib/nft-guarded-purse-local-store'

export type NftGuardedPurseActionResult =
  | { ok: true; digest: string; purseObjectId?: string }
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

function pickCreatedPurseId(effects: unknown, events: unknown): string | undefined {
  try {
    const evs = (events as Array<{ type?: string; parsedJson?: { purse_id?: string } }>) || []
    for (const ev of evs) {
      if (ev.type?.includes('::nft_guarded_purse::PurseCreated') && ev.parsedJson?.purse_id) {
        const id = String(ev.parsedJson.purse_id).trim().toLowerCase()
        if (HEX64.test(id)) return id
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const e = effects as {
      created?: Array<{ reference?: { objectId?: string } }>
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

export async function createNftGuardedPurse(input: {
  messagingPackageId: string
  nftObjectId: string
  amountMist: bigint
  imageNftPackageId?: string
}): Promise<NftGuardedPurseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildCreateGuardedPurseTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      nftObjectId: input.nftObjectId,
      splitFromGasMist: input.amountMist,
      imageNftPackageId: input.imageNftPackageId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({
      client,
      transaction: txb,
      signer,
    })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return {
        ok: false,
        error: `create_purse fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.`,
      }
    }
    let purseObjectId: string | undefined
    try {
      const tx = await client.getTransactionBlock({
        digest: out.digest,
        options: { showEffects: true, showEvents: true },
      })
      purseObjectId = pickCreatedPurseId(tx.effects, (tx as { events?: unknown }).events)
    } catch {
      /* manuell nachtragen */
    }
    if (purseObjectId) {
      upsertNftGuardedPurseLocal({
        purseObjectId,
        nftObjectId: input.nftObjectId,
        owner: sender,
        balanceMistHint: input.amountMist.toString(),
        status: 'active',
      })
    }
    return { ok: true, digest: out.digest, purseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function depositNftGuardedPurse(input: {
  messagingPackageId: string
  purseObjectId: string
  amountMist: bigint
}): Promise<NftGuardedPurseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildDepositGuardedPurseTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      purseObjectId: input.purseObjectId,
      splitFromGasMist: input.amountMist,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return {
        ok: false,
        error: `deposit fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.`,
      }
    }
    patchNftGuardedPurseLocal(input.purseObjectId, {
      balanceMistHint: `+${input.amountMist.toString()} (nach Deposit)`,
    })
    return { ok: true, digest: out.digest, purseObjectId: input.purseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function spendNftGuardedPurse(input: {
  messagingPackageId: string
  purseObjectId: string
  nftObjectId: string
  amountMist: bigint
  recipientAddress: string
  imageNftPackageId?: string
}): Promise<NftGuardedPurseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildSpendGuardedPurseTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      purseObjectId: input.purseObjectId,
      nftObjectId: input.nftObjectId,
      amountMist: input.amountMist,
      recipientAddress: input.recipientAddress,
      imageNftPackageId: input.imageNftPackageId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return {
        ok: false,
        error: `spend fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.`,
      }
    }
    patchNftGuardedPurseLocal(input.purseObjectId, {
      balanceMistHint: `−${input.amountMist.toString()} (nach Spend)`,
    })
    return { ok: true, digest: out.digest, purseObjectId: input.purseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function destroyEmptyNftGuardedPurse(input: {
  messagingPackageId: string
  purseObjectId: string
}): Promise<NftGuardedPurseActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildDestroyEmptyGuardedPurseTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      purseObjectId: input.purseObjectId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return {
        ok: false,
        error: `destroy_empty fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.`,
      }
    }
    removeNftGuardedPurseLocal(input.purseObjectId)
    return { ok: true, digest: out.digest, purseObjectId: input.purseObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
