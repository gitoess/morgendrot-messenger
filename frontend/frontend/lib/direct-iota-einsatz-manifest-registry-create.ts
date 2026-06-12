'use client'

import {
    attachGasPaymentForOwner,
    buildCreateEinsatzManifestRegistryTransaction,
    createDirectIotaClient,
    fetchEinsatzManifestRegistryIdFromDigest,
    isDirectChainExecutionSuccess,
    signAndExecuteTransactionWithSigner,
} from '@morgendrot/core/iota'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { getDirectIotaSessionSigner, getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import {
    resolveEinsatzManifestAnchorRpcUrl,
    writeBossMainnetRpcOverride,
} from '@/frontend/lib/direct-iota-einsatz-manifest-anchor'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export function canTryCreateEinsatzManifestRegistry(opts: {
    registryObjectId?: string
    mainnetPackageId?: string
}): boolean {
    if (HEX64.test((opts.registryObjectId ?? '').trim())) return false
    if (!HEX64.test((opts.mainnetPackageId ?? '').trim())) return false
    return Boolean(getDirectIotaSessionSigner() && getDirectIotaSessionSignerAddress())
}

export async function tryCreateEinsatzManifestRegistryViaDirectIota(opts: {
    mainnetPackageId: string
    mainnetRpcFromStatus?: string
    /** Default: Session-Signer — wird `authorized_anchorer`. */
    authorizedAnchorer?: string
}): Promise<
    | { ok: true; registryId: string; digest?: string }
    | { ok: false; error: string }
> {
    const pkg = opts.mainnetPackageId.trim()
    if (!HEX64.test(pkg)) {
        return { ok: false, error: 'MAINNET_PACKAGE_ID bzw. Package-ID fehlt (0x+64).' }
    }
    const signer = getDirectIotaSessionSigner()
    const signerAddr = getDirectIotaSessionSignerAddress()?.trim() ?? ''
    if (!signer || !HEX64.test(signerAddr)) {
        return { ok: false, error: 'Kein Session-Signer — Wallet/Mnemonic im Puls anwenden.' }
    }
    const anchorer = (opts.authorizedAnchorer?.trim() || signerAddr).toLowerCase()
    if (!HEX64.test(anchorer)) {
        return { ok: false, error: 'authorized_anchorer ungültig.' }
    }
    if (anchorer !== signerAddr.toLowerCase()) {
        return {
            ok: false,
            error: 'Registry muss mit der Puls-Wallet angelegt werden (Signer = authorized_anchorer).',
        }
    }

    const rpc = resolveEinsatzManifestAnchorRpcUrl({
        mainnetRpcFromStatus: opts.mainnetRpcFromStatus,
    })
    if (!rpc) {
        return { ok: false, error: 'Keine RPC-URL für Registry-Deploy (Mainnet oder Direkt-RPC).' }
    }
    if (opts.mainnetRpcFromStatus) writeBossMainnetRpcOverride(opts.mainnetRpcFromStatus)

    try {
        const client = createDirectIotaClient({ rpcUrl: rpc })
        const txb = buildCreateEinsatzManifestRegistryTransaction({
            packageId: pkg,
            senderAddress: signerAddr,
            authorizedAnchorer: anchorer,
        })
        await attachGasPaymentForOwner(client, txb, signerAddr)
        const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
        if (!isDirectChainExecutionSuccess(out.digest, out.status)) {
            return { ok: false, error: `Chain-Status: ${out.status || 'kein Digest'}.` }
        }
        const registryId = out.digest
            ? await fetchEinsatzManifestRegistryIdFromDigest(client, out.digest)
            : null
        if (!registryId) {
            return {
                ok: false,
                error:
                    'TX gesendet, aber registry_id nicht aus Event gelesen — Digest im Explorer prüfen oder npm run apply:einsatz-manifest-registry-from-tx.',
            }
        }
        return { ok: true, registryId, digest: out.digest }
    } catch (e) {
        return { ok: false, error: formatDirectIotaSubmitError(e) }
    }
}
