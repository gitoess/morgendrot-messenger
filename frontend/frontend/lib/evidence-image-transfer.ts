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
import { parkLocalVaultIndexForNft } from '@/frontend/lib/nft-vault-local-clear'
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
  // Schlüsselkarte bewusst NICHT aus dem Tresor löschen — sonst sind Bindungen nach
  // Rückkehr weg. Aktiven Purse-Index parken (Anzeige aus, Metadaten bleiben).
  try {
    parkLocalVaultIndexForNft(objectId)
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function isStaleObjectVersionError(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    (m.includes('is not available') && m.includes('version')) ||
    m.includes('objectnotfound') ||
    m.includes('object not found') ||
    m.includes('not exists') ||
    m.includes('version mismatch')
  )
}

/** Package-ID aus On-Chain-Typ `0x…::image_nft::ImageNFT`, sonst Fallback. */
async function resolveImageNftPackageId(
  client: ReturnType<typeof createDirectIotaClient>,
  objectId: string,
  fallback?: string
): Promise<string> {
  try {
    const o = await client.getObject({ id: objectId, options: { showType: true } })
    const t = (o.data as { type?: string } | null | undefined)?.type || ''
    const pkg = t.split('::')[0]?.trim().toLowerCase()
    if (pkg && /^0x[a-f0-9]{64}$/.test(pkg)) return pkg
  } catch {
    /* fallback */
  }
  return (fallback || KNOWN_IMAGE_NFT_PACKAGE_IDS[0]).trim().toLowerCase()
}

/** Nach Spend: warten bis Object wieder lesbar ist (RPC-Lag / neue Version). */
async function waitForOwnedNftReadable(
  client: ReturnType<typeof createDirectIotaClient>,
  objectId: string,
  waitForDigest?: string
): Promise<void> {
  if (waitForDigest?.trim()) {
    const dig = waitForDigest.trim()
    for (let i = 0; i < 10; i++) {
      try {
        const tx = await client.getTransactionBlock({ digest: dig, options: { showEffects: true } })
        if (tx?.digest || (tx as { effects?: unknown })?.effects) break
      } catch {
        /* noch nicht indexiert */
      }
      await sleep(300 + i * 150)
    }
  }
  for (let i = 0; i < 8; i++) {
    try {
      const o = await client.getObject({
        id: objectId,
        options: { showOwner: true },
      })
      if (o.data && !(o as { error?: unknown }).error) return
    } catch {
      /* retry */
    }
    await sleep(350 + i * 200)
  }
}

export async function burnEvidenceImageNft(input: {
  objectId: string
  packageId?: string
  /** Optional: Spend-Digest — erst Effects abwarten, dann burnen. */
  waitForDigest?: string
}): Promise<EvidenceImageChainActionResult> {
  const prep = await prepareSignerClient()
  if (!prep.ok) return prep
  const { client, signer, sender } = prep
  const oid = input.objectId.trim().toLowerCase()
  try {
    await waitForOwnedNftReadable(client, oid, input.waitForDigest)
    const packageId = await resolveImageNftPackageId(client, oid, input.packageId)
    let lastErr = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await waitForOwnedNftReadable(client, oid)
        await sleep(400 * attempt)
      }
      try {
        const txb = buildBurnImageNftTransaction({
          senderAddress: sender,
          objectId: oid,
          packageId,
        })
        await attachGasPaymentForOwner(client, txb, sender, GAS_BUDGET)
        const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
        if (!isDirectChainExecutionSuccess(out.digest, out.status) || !out.digest) {
          lastErr = out.errorDetail || 'Burn fehlgeschlagen'
          if (!isStaleObjectVersionError(lastErr)) {
            return { ok: false, error: `Burn fehlgeschlagen — ${lastErr}.` }
          }
          continue
        }
        clearLocalNftSecrets(oid)
        recordNftActivity({ kind: 'burned', objectId: oid, digest: out.digest })
        return { ok: true, digest: out.digest }
      } catch (e) {
        lastErr = formatDirectIotaSubmitError(e)
        if (!isStaleObjectVersionError(lastErr) && attempt === 2) {
          return { ok: false, error: lastErr }
        }
        if (!isStaleObjectVersionError(lastErr) && attempt < 2) {
          /* non-stale: still one retry for RPC flakes */
        }
      }
    }
    return {
      ok: false,
      error: `Burn fehlgeschlagen — Objekt-Version noch nicht bereit (${lastErr || 'RPC'}). Kurz warten und Burn erneut.`,
    }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
