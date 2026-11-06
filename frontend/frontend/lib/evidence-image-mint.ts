'use client'

/**
 * Evidenz-ImageNFT minten (Direkt-RPC + Session-Signer).
 * Optional: AES-Passphrase → MORGIMGE1 in image_data; Passphrase nur UI (nie Chain).
 * Bild wird wie Chat-Anhänge zuerst lokal verkleinert (Ziel ~12 KB).
 */

import {
  attachGasPaymentForOwner,
  createDirectIotaClient,
  getOwnerIotaBalanceMist,
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
  EVIDENCE_IMAGE_MAX_RAW_BYTES,
  KNOWN_IMAGE_NFT_PACKAGE_IDS,
} from '@/frontend/lib/evidence-onchain-image'
import {
  encryptEvidenceImageBytes,
  generateEvidenceImageSharePassphrase,
} from '@/frontend/lib/evidence-image-crypto'
import { buildMintImageNftTransaction } from '@/frontend/lib/evidence-image-nft-txb'
import {
  estimateImageNftMintGasBudget,
  prepareEvidenceImageForMint,
} from '@/frontend/lib/evidence-image-mint-prepare'
import { resolveImageNftObjectIdFromDigest } from '@/frontend/lib/evidence-image-mint-object-id'
import {
  packEvidenceDescription,
  type EvidenceAttrPair,
} from '@/frontend/lib/evidence-image-attrs'
import { appendNftKeycardDescriptionMarker } from '@/frontend/lib/nft-keycard-description-marker'

export type MintEvidenceImageInput = {
  plainBytes: Uint8Array
  contentType: string
  name: string
  description?: string
  classification?: string
  /** Freie Attribute → in description als [morg-attrs] (kein Move-DF). */
  attrs?: readonly EvidenceAttrPair[]
  /** true → Ciphertext on-chain + Passphrase zurückgeben */
  encrypt: boolean
  /** optional eigene Passphrase; sonst generiert */
  passphrase?: string
  packageId?: string
  /** false → keine Auto-Verkleinerung (Default: true) */
  autoResize?: boolean
  /** B2 P3: öffentlicher [morg-keycard]-Hinweis in der Description */
  keycardHint?: { cardObjectId: string; slotId?: string }
}

export type MintEvidenceImageResult =
  | {
      ok: true
      digest: string
      objectId?: string
      encrypted: boolean
      passphrase?: string
      contentHashHex: string
      onChainBytes: number
      resized?: boolean
      originalBytes?: number
    }
  | { ok: false; error: string }

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const dig = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(dig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function mintEvidenceImageNft(input: MintEvidenceImageInput): Promise<MintEvidenceImageResult> {
  if (isIotaRelayOnlyMode()) {
    return { ok: false, error: 'Mint braucht Direkt-RPC (nicht „Nur Morgendrot-API“).' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  const signer = getDirectIotaSessionSigner()
  const signerAddr = getDirectIotaSessionSignerAddress()
  if (!signer || !signerAddr) {
    return { ok: false, error: 'Kein Session-Signer — Tresor entsperren.' }
  }
  if (!input.plainBytes.length) return { ok: false, error: 'Kein Bild.' }

  let plainBytes = input.plainBytes
  let contentType = input.contentType || 'image/png'
  let resized = false
  let originalBytes = input.plainBytes.length

  if (input.autoResize !== false) {
    try {
      const prep = await prepareEvidenceImageForMint(plainBytes, contentType)
      plainBytes = prep.bytes
      contentType = prep.contentType
      resized = prep.resized
      originalBytes = prep.originalBytes
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : `Bild-Verkleinerung fehlgeschlagen: ${String(e)}`,
      }
    }
  }

  if (plainBytes.length > EVIDENCE_IMAGE_MAX_RAW_BYTES) {
    return {
      ok: false,
      error: `Bild zu groß (${plainBytes.length} B, max. ${EVIDENCE_IMAGE_MAX_RAW_BYTES} B).`,
    }
  }

  const contentHashHex = await sha256Hex(plainBytes)
  let imageData = plainBytes
  let encrypted = false
  let passphrase: string | undefined

  if (input.encrypt) {
    passphrase = (input.passphrase || generateEvidenceImageSharePassphrase()).trim()
    if (passphrase.length < 8) return { ok: false, error: 'Passphrase mindestens 8 Zeichen.' }
    const enc = await encryptEvidenceImageBytes(imageData, passphrase, contentType || 'image/png')
    imageData = enc.blob
    encrypted = true
    if (imageData.length > EVIDENCE_IMAGE_MAX_RAW_BYTES) {
      return {
        ok: false,
        error: `Ciphertext zu groß (${imageData.length} B). Bild verkleinern.`,
      }
    }
  }

  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const estimated = estimateImageNftMintGasBudget(imageData.length)
    const bal = await getOwnerIotaBalanceMist(client, signerAddr)
    const minBudget = 50_000_000n
    if (bal < minBudget) {
      return {
        ok: false,
        error: `Insufficient Gas: Wallet nur ${bal} MIST (mind. ~${minBudget} für ImageNFT-Mint, Bytes ${imageData.length}). IOTA nachladen.`,
      }
    }
    /** Großzügig schätzen, aber nicht mehr als verfügbar verlangen. */
    const gasBudget = bal >= estimated ? estimated : bal

    let descriptionBase = (input.description || '').trim() || 'MORGENDROT Evidence'
    if (input.keycardHint?.cardObjectId) {
      descriptionBase = appendNftKeycardDescriptionMarker(descriptionBase, {
        cardObjectId: input.keycardHint.cardObjectId,
        slotId: input.keycardHint.slotId || 'img',
      })
    }
    const descriptionPacked = packEvidenceDescription(descriptionBase, input.attrs || [])
    const mintArgs = {
      packageId: input.packageId || KNOWN_IMAGE_NFT_PACKAGE_IDS[0],
      senderAddress: signerAddr,
      name: input.name.trim() || 'Evidence',
      description: descriptionPacked,
      imageData,
      contentType: encrypted ? 'application/octet-stream' : contentType || 'image/png',
      createdAtMs: Date.now(),
      encrypted,
      hashHex: contentHashHex,
      classification: (input.classification || '').trim() || 'evidence',
    }

    const txb = buildMintImageNftTransaction(mintArgs)
    await attachGasPaymentForOwner(client, txb, signerAddr, gasBudget)

    let dryDetail = ''
    try {
      const built = await txb.build({ client })
      const dry = (await client.dryRunTransactionBlock({
        transactionBlock: built,
      })) as { effects?: { status?: { status?: string; error?: unknown } } }
      const st = dry?.effects?.status
      if (st && String(st.status || '').toLowerCase() === 'failure') {
        const err =
          typeof st.error === 'string'
            ? st.error
            : st.error != null
              ? JSON.stringify(st.error)
              : 'unbekannt'
        return {
          ok: false,
          error: `Dry-Run failure: ${err} (Bytes ${imageData.length}, Gas ${gasBudget}, Wallet ${bal} MIST).`,
        }
      }
    } catch (dryErr) {
      dryDetail = dryErr instanceof Error ? dryErr.message : String(dryErr)
    }

    /** build() verbraucht die TX — Execute immer mit frischer PTB. */
    const txbExec = buildMintImageNftTransaction({
      ...mintArgs,
      createdAtMs: Date.now(),
    })
    await attachGasPaymentForOwner(client, txbExec, signerAddr, gasBudget)

    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txbExec, signer })
    if (!isDirectChainExecutionSuccess(out.digest, out.status)) {
      const detail = out.errorDetail ? ` — ${out.errorDetail}` : dryDetail ? ` — dryRun-Hinweis: ${dryDetail}` : ''
      return {
        ok: false,
        error: `Chain-Status: ${out.status || 'kein Digest'}${detail} (Bytes ${imageData.length}, Gas ${gasBudget}).`,
      }
    }
    const objectId = (await resolveImageNftObjectIdFromDigest(out.digest!)) || undefined
    return {
      ok: true,
      digest: out.digest!,
      objectId,
      encrypted,
      passphrase: encrypted ? passphrase : undefined,
      contentHashHex,
      onChainBytes: imageData.length,
      resized,
      originalBytes,
    }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
