'use client'

import {
    attachGasPaymentForOwner,
    buildStoreEinsatzManifestTransaction,
    createDirectIotaClient,
    isDirectChainExecutionSuccess,
    signAndExecuteTransactionWithSigner,
    type EinsatzManifestSourceNetworkU8,
} from '@morgendrot/core/iota'
import { einsatzChainModeSourceNetwork } from '@morgendrot/shared/einsatz-chain-mode'
import { resolveActiveEinsatzChainMode } from '@/frontend/lib/einsatz-chain-mode-local'
import { einsatzIdUtf8ToMoveAddress, type EinsatzManifestV1 } from '@/frontend/lib/einsatz-manifest-v1'
import { verifyEinsatzManifestV1 as verifyManifest } from '@/frontend/lib/einsatz-manifest-verify'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSigner, getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'

const LS_MAINNET_RPC = 'morgendrot.boss.mainnetRpcUrl.v1'

export function readBossMainnetRpcOverride(): string {
    if (typeof window === 'undefined') return ''
    try {
        return window.localStorage.getItem(LS_MAINNET_RPC)?.trim() ?? ''
    } catch {
        return ''
    }
}

export function writeBossMainnetRpcOverride(url: string): void {
    if (typeof window === 'undefined') return
    try {
        const v = url.trim()
        if (v) window.localStorage.setItem(LS_MAINNET_RPC, v)
        else window.localStorage.removeItem(LS_MAINNET_RPC)
    } catch {
        /* ignore */
    }
}

export function resolveEinsatzManifestAnchorRpcUrl(opts?: {
    mainnetRpcFromStatus?: string
    operationRpcHint?: string
}): string {
    const mode = resolveActiveEinsatzChainMode()
    if (mode === 'testnet-with-mainnet-anchor') {
        return (
            readBossMainnetRpcOverride() ||
            (opts?.mainnetRpcFromStatus ?? '').trim() ||
            'https://api.mainnet.iota.cafe'
        )
    }
    return getConfiguredDirectIotaRpcUrl() || (opts?.operationRpcHint ?? '').trim() || ''
}

export function canTryEinsatzManifestAnchorSubmit(registryObjectId?: string): boolean {
    const reg = (registryObjectId ?? '').trim()
    if (!/^0x[a-fA-F0-9]{64}$/i.test(reg)) return false
    return Boolean(getDirectIotaSessionSigner() && getDirectIotaSessionSignerAddress())
}

export async function tryAnchorEinsatzManifestViaDirectIota(opts: {
    manifest: EinsatzManifestV1
    registryObjectId: string
    mainnetPackageId: string
    mainnetRpcFromStatus?: string
}): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
    const verified = await verifyManifest(opts.manifest)
    if (!verified.ok) return { ok: false, error: verified.error }

    const rpc = resolveEinsatzManifestAnchorRpcUrl({
        mainnetRpcFromStatus: opts.mainnetRpcFromStatus,
    })
    if (!rpc) {
        return { ok: false, error: 'Keine RPC-URL für Anker (Mainnet oder Direkt-RPC).' }
    }
    const signer = getDirectIotaSessionSigner()
    const signerAddr = getDirectIotaSessionSignerAddress()
    if (!signer || !signerAddr) {
        return { ok: false, error: 'Kein Session-Signer — Wallet/Mnemonic im Puls anwenden.' }
    }
    const reg = opts.registryObjectId.trim()
    if (!/^0x[a-fA-F0-9]{64}$/i.test(reg)) {
        return {
            ok: false,
            error: 'EINSATZ_MANIFEST_REGISTRY_ID fehlt — nach Move-Deploy in Boss-.env setzen.',
        }
    }

    const chainMode = resolveActiveEinsatzChainMode()
    const sourceNetwork: EinsatzManifestSourceNetworkU8 =
        einsatzChainModeSourceNetwork(chainMode, rpc) === 'mainnet' ? 1 : 0
    const pkg =
        sourceNetwork === 1
            ? opts.mainnetPackageId.trim()
            : opts.manifest.source_package_id.trim()

    try {
        const einsatzAddr = await einsatzIdUtf8ToMoveAddress(opts.manifest.einsatz_id)
        const client = createDirectIotaClient({ rpcUrl: rpc })
        const txb = buildStoreEinsatzManifestTransaction({
            packageId: pkg,
            registryObjectId: reg,
            senderAddress: signerAddr.trim(),
            einsatzIdMoveAddress: einsatzAddr,
            sequence: BigInt(opts.manifest.sequence),
            manifestHashHex: opts.manifest.manifest_hash,
            merkleRootHex: opts.manifest.merkle_root,
            sourceNetwork,
            sourcePackageId: opts.manifest.source_package_id,
            periodStartMs: BigInt(opts.manifest.period_start_ms),
            periodEndMs: BigInt(opts.manifest.period_end_ms),
            messageCount: BigInt(opts.manifest.entries.length),
        })
        await attachGasPaymentForOwner(client, txb, signerAddr.trim())
        const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
        if (isDirectChainExecutionSuccess(out.digest, out.status)) {
            return { ok: true, digest: out.digest }
        }
        return { ok: false, error: `Chain-Status: ${out.status || 'kein Digest'}.` }
    } catch (e) {
        return { ok: false, error: formatDirectIotaSubmitError(e) }
    }
}
