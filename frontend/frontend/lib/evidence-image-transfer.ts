/**
 * ImageNFT senden (Transfer) / vernichten (Burn) — Direkt-RPC + Session-Signer.
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
  buildBurnImageNftTransaction,
  buildTransferImageNftTransaction,
} from '@/frontend/lib/evidence-image-nft-txb'
import { forgetEvidencePassphrase } from '@/frontend/lib/evidence-passphrase-local-store'
import { forgetNftKeycard } from '@/frontend/lib/nft-keycard-local-store'
import { recordNftActivity } from '@/frontend/lib/nft-activity-local-log'
import { KNOWN_IMAGE_NFT_PACKAGE_IDS } from '@/frontend/lib/evidence-onchain-image'

export type EvidenceImageChainActionResult =
  | { ok: true; digest: string }
  | { ok: false; error: string }

const GAS_BUDGET = 40_000_000n

async function prepareSignerClient(): Promise<
  | { ok: true; client: ReturnType<typeof createDirectIotaClient>; signer: NonNullable<ReturnType<typeof getDirectIotaSessionSigner>>; sender: string }
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
    return { ok: false, error: 'Kein Session-Signer — Vault-Passwort / Privacy entsperren.' }
  }
  return { ok: true, client: createDirectIotaClient({ rpcUrl: rpc }), signer, sender }
}

function clearLocalNftSecrets(objectId: string): void {
  try {
    forgetEvidencePassphrase(objectId)
  } catch {
    /* ignore */
  }
  try {
    forgetNftKeycard(objectId)
  } catch {
    /* ignore */
  }
}

export async function transferEvidenceImageNft(input: {
  objectId: string
  recipientAddress: string
}): Promise<EvidenceImageChainActionResult> {
  const prep = await prepareSignerClient()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildTransferImageNftTransaction({
      senderAddress: sender,
      objectId: input.objectId,
      recipientAddress: input.recipientAddress,
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      const detail = out.errorDetail ? ` — ${out.errorDetail}` : ''
      return { ok: false, error: `Transfer fehlgeschlagen${detail}.` }
    }
    const oid = input.objectId.trim().toLowerCase()
    clearLocalNftSecrets(oid)
    recordNftActivity({
      kind: 'sent',
      objectId: oid,
      counterparty: input.recipientAddress,
      digest: out.digest,
    })
    return { ok: true, digest: out.digest }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function burnEvidenceImageNft(input: {
  objectId: string
  packageId?: string
}): Promise<EvidenceImageChainActionResult> {
  const prep = await prepareSignerClient()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  try {
    const txb = buildBurnImageNftTransaction({
      senderAddress: sender,
      objectId: input.objectId,
      packageId: input.packageId || KNOWN_IMAGE_NFT_PACKAGE_IDS[0],
    })
    await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
      const detail = out.errorDetail ? ` — ${out.errorDetail}` : ''
      return { ok: false, error: `Burn fehlgeschlagen${detail}.` }
    }
    const oid = input.objectId.trim().toLowerCase()
    clearLocalNftSecrets(oid)
    recordNftActivity({ kind: 'burned', objectId: oid, digest: out.digest })
    return { ok: true, digest: out.digest }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
