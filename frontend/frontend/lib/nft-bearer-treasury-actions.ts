/**
 * B2-S3 — create / deposit / withdraw / freeze / reclaim signieren + lokalen Index.
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
  buildAdminReclaimBearerTreasuryTransaction,
  buildAdminSetFrozenBearerTreasuryTransaction,
  buildCreateBearerTreasuryTransaction,
  buildDepositBearerTreasuryTransaction,
  buildWithdrawBearerTreasuryTransaction,
} from '@/frontend/lib/nft-bearer-treasury-txb'
import { recordNftVaultActivity } from '@/frontend/lib/iota-activity-local-log'
import { bindVaultToNftKeycard, getNftKeycard } from '@/frontend/lib/nft-keycard-local-store'
import {
  findNftBearerTreasuryById,
  patchNftBearerTreasuryLocal,
  upsertNftBearerTreasuryLocal,
} from '@/frontend/lib/nft-bearer-treasury-local-store'

export type NftBearerTreasuryActionResult =
  | { ok: true; digest: string; treasuryObjectId?: string }
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

function pickCreatedTreasuryId(
  effects: unknown,
  events: unknown,
  objectChanges?: unknown
): string | undefined {
  try {
    const evs = (events as Array<{ type?: string; parsedJson?: { treasury_id?: string } }>) || []
    for (const ev of evs) {
      if (ev.type?.includes('::nft_bearer_treasury::TreasuryCreated') && ev.parsedJson?.treasury_id) {
        const id = String(ev.parsedJson.treasury_id).trim().toLowerCase()
        if (HEX64.test(id)) return id
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const changes = (Array.isArray(objectChanges) ? objectChanges : []) as Array<{
      type?: string
      objectType?: string
      objectId?: string
    }>
    for (const c of changes) {
      if (c.type !== 'created') continue
      if (!(c.objectType || '').includes('::nft_bearer_treasury::NftGuardedTreasury')) continue
      const id = c.objectId?.trim().toLowerCase()
      if (id && HEX64.test(id)) return id
    }
  } catch {
    /* ignore */
  }
  try {
    const e = effects as { created?: Array<{ reference?: { objectId?: string } }> }
    for (const c of e.created || []) {
      const id = c.reference?.objectId?.trim().toLowerCase()
      if (id && HEX64.test(id)) return id
    }
  } catch {
    /* ignore */
  }
  return undefined
}

export async function createNftBearerTreasury(input: {
  messagingPackageId: string
  nftObjectId: string
  amountMist: bigint
  imageNftPackageId?: string
}): Promise<NftBearerTreasuryActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildCreateBearerTreasuryTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      nftObjectId: input.nftObjectId,
      splitFromGasMist: input.amountMist,
      imageNftPackageId: input.imageNftPackageId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return {
        ok: false,
        error: `create_treasury fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.`,
      }
    }
    let treasuryObjectId: string | undefined
    try {
      const tx = await client.getTransactionBlock({
        digest: out.digest,
        options: { showEffects: true, showEvents: true, showObjectChanges: true },
      })
      treasuryObjectId = pickCreatedTreasuryId(
        tx.effects,
        (tx as { events?: unknown }).events,
        (tx as { objectChanges?: unknown }).objectChanges
      )
    } catch {
      /* manuell / recover */
    }
    if (!treasuryObjectId) {
      try {
        const { recoverNftVaultFromDigest } = await import('@/frontend/lib/nft-vault-recover-from-tx')
        const rec = await recoverNftVaultFromDigest(out.digest)
        if (rec.ok && rec.vault.kind === 'bearer') {
          return { ok: true, digest: out.digest, treasuryObjectId: rec.vault.treasuryObjectId }
        }
      } catch {
        /* unten Activity ohne ID */
      }
    }
    const label = getNftKeycard(input.nftObjectId)?.label
    if (treasuryObjectId) {
      const pkg = input.messagingPackageId.trim().toLowerCase()
      upsertNftBearerTreasuryLocal({
        treasuryObjectId,
        nftObjectId: input.nftObjectId,
        admin: sender,
        balanceMistHint: input.amountMist.toString(),
        frozen: false,
        status: 'active',
        messagingPackageId: pkg,
        createDigest: out.digest,
        ...(label ? { displayLabel: label } : {}),
      })
      bindVaultToNftKeycard({
        objectId: input.nftObjectId,
        vault: {
          kind: 'bearer',
          vaultObjectId: treasuryObjectId,
          messagingPackageId: pkg,
          createDigest: out.digest,
        },
      })
    }
    recordNftVaultActivity({
      op: 'treasury_create',
      vaultObjectId: treasuryObjectId,
      nftObjectId: input.nftObjectId,
      amountMist: input.amountMist,
      digest: out.digest,
      nftLabel: label,
    })
    return { ok: true, digest: out.digest, treasuryObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function depositNftBearerTreasury(input: {
  messagingPackageId: string
  treasuryObjectId: string
  amountMist: bigint
}): Promise<NftBearerTreasuryActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildDepositBearerTreasuryTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      treasuryObjectId: input.treasuryObjectId,
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
    patchNftBearerTreasuryLocal(input.treasuryObjectId, {
      balanceMistHint: `+${input.amountMist.toString()} (nach Deposit)`,
    })
    const local = findNftBearerTreasuryById(input.treasuryObjectId)
    recordNftVaultActivity({
      op: 'treasury_deposit',
      vaultObjectId: input.treasuryObjectId,
      nftObjectId: local?.nftObjectId,
      amountMist: input.amountMist,
      digest: out.digest,
      nftLabel: local?.displayLabel || (local ? getNftKeycard(local.nftObjectId)?.label : undefined),
    })
    return { ok: true, digest: out.digest, treasuryObjectId: input.treasuryObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function withdrawNftBearerTreasury(input: {
  messagingPackageId: string
  treasuryObjectId: string
  nftObjectId: string
  amountMist: bigint
  recipientAddress: string
  imageNftPackageId?: string
}): Promise<NftBearerTreasuryActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildWithdrawBearerTreasuryTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      treasuryObjectId: input.treasuryObjectId,
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
        error: `withdraw fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.`,
      }
    }
    patchNftBearerTreasuryLocal(input.treasuryObjectId, {
      balanceMistHint: `−${input.amountMist.toString()} (nach Withdraw)`,
    })
    recordNftVaultActivity({
      op: 'treasury_withdraw',
      vaultObjectId: input.treasuryObjectId,
      nftObjectId: input.nftObjectId,
      amountMist: input.amountMist,
      digest: out.digest,
      recipient: input.recipientAddress,
      nftLabel: getNftKeycard(input.nftObjectId)?.label,
    })
    return { ok: true, digest: out.digest, treasuryObjectId: input.treasuryObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function adminSetFrozenNftBearerTreasury(input: {
  messagingPackageId: string
  treasuryObjectId: string
  frozen: boolean
}): Promise<NftBearerTreasuryActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildAdminSetFrozenBearerTreasuryTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      treasuryObjectId: input.treasuryObjectId,
      frozen: input.frozen,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return {
        ok: false,
        error: `admin_set_frozen fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.`,
      }
    }
    patchNftBearerTreasuryLocal(input.treasuryObjectId, { frozen: input.frozen })
    const local = findNftBearerTreasuryById(input.treasuryObjectId)
    recordNftVaultActivity({
      op: 'treasury_freeze',
      vaultObjectId: input.treasuryObjectId,
      nftObjectId: local?.nftObjectId,
      digest: out.digest,
      nftLabel: local?.displayLabel,
    })
    return { ok: true, digest: out.digest, treasuryObjectId: input.treasuryObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function adminReclaimNftBearerTreasury(input: {
  messagingPackageId: string
  treasuryObjectId: string
}): Promise<NftBearerTreasuryActionResult> {
  const prep = await prepare()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildAdminReclaimBearerTreasuryTransaction({
      messagingPackageId: input.messagingPackageId,
      senderAddress: sender,
      treasuryObjectId: input.treasuryObjectId,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      return {
        ok: false,
        error: `admin_reclaim fehlgeschlagen${out.errorDetail ? ` — ${out.errorDetail}` : ''}.`,
      }
    }
    patchNftBearerTreasuryLocal(input.treasuryObjectId, { balanceMistHint: '0 (reclaimed)' })
    const local = findNftBearerTreasuryById(input.treasuryObjectId)
    recordNftVaultActivity({
      op: 'treasury_reclaim',
      vaultObjectId: input.treasuryObjectId,
      nftObjectId: local?.nftObjectId,
      digest: out.digest,
      nftLabel: local?.displayLabel,
    })
    return { ok: true, digest: out.digest, treasuryObjectId: input.treasuryObjectId }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
