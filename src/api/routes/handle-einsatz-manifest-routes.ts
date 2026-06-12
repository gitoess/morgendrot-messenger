/**
 * § H.33 — Einsatz-Manifest Mainnet (Proxy-RPC über Boss-API).
 */
import type http from 'node:http';
import {
    createDirectIotaClient,
    fetchEinsatzManifestAnchorsForEinsatz,
    probeEinsatzManifestAnchorOnChain,
    type EinsatzManifestAnchorRow,
} from '@morgendrot/core/iota';
import { CFG } from '../../config.js';
import { mask, rpcUrlLabel } from '../http-middleware.js';
import type { SendJsonFn } from './api-route-types.js';
import {
    DEFAULT_MAINNET_RPC_URL,
    EINSATZ_CHAIN_MODE_ENV_KEY,
    einsatzChainModeShowsManifestAnchorUi,
    parseEinsatzChainMode,
} from '../../shared/einsatz-chain-mode.js';
import {
    einsatzIdUtf8ToMoveAddressSync,
    resolveServerEinsatzIdUtf8,
} from '../../shared/einsatz-manifest-server.js';

const HEX64 = /^0x[a-fA-F0-9]{64}$/i;

function canAccessEinsatzManifestApi(): boolean {
    const role = CFG.ROLE;
    return role === 'boss' || role === 'kommandant' || role === 'messenger';
}

function parseRequestQuery(req: http.IncomingMessage): URLSearchParams {
    try {
        return new URL(req.url || '/', 'http://localhost').searchParams;
    } catch {
        return new URLSearchParams();
    }
}

function resolveMainnetRpcUrl(): string {
    return (CFG.MAINNET_RPC_URL || '').trim() || DEFAULT_MAINNET_RPC_URL;
}

function resolveMainnetPackageId(): string {
    return (CFG.MAINNET_PACKAGE_ID || '').trim() || (CFG.PACKAGE_ID || '').trim();
}

function denyIfUnauthorized(
    res: http.ServerResponse,
    cors: Record<string, string>,
    sendJson: SendJsonFn
): boolean {
    if (canAccessEinsatzManifestApi()) return false;
    sendJson(res, 403, { ok: false, error: 'Nur Boss/Kommandant/Werkstatt.' }, cors);
    return true;
}

function resolveEinsatzContext(query: URLSearchParams): {
    einsatzIdUtf8: string;
    einsatzIdMoveAddress: string;
} {
    const einsatzIdUtf8 = resolveServerEinsatzIdUtf8({
        handoffLabel: CFG.HANDOFF_LABEL,
        packageId: CFG.PACKAGE_ID,
        queryOverride: query.get('einsatzId') ?? undefined,
    });
    return {
        einsatzIdUtf8,
        einsatzIdMoveAddress: einsatzIdUtf8ToMoveAddressSync(einsatzIdUtf8),
    };
}

function manifestConfigPayload(query: URLSearchParams) {
    const chainMode = parseEinsatzChainMode(process.env[EINSATZ_CHAIN_MODE_ENV_KEY]);
    const registryId = (CFG.EINSATZ_MANIFEST_REGISTRY_ID || '').trim();
    const mainnetPkg = resolveMainnetPackageId();
    const mainnetRpc = resolveMainnetRpcUrl();
    const ctx = resolveEinsatzContext(query);
    const role = CFG.ROLE;
    const exposeRpc = role === 'boss' || role === 'kommandant';

    return {
        ok: true as const,
        chainMode,
        showManifestAnchorUi: einsatzChainModeShowsManifestAnchorUi(chainMode),
        einsatzIdUtf8: ctx.einsatzIdUtf8,
        einsatzIdMoveAddress: ctx.einsatzIdMoveAddress,
        packageId: (CFG.PACKAGE_ID || '').trim() || undefined,
        handoffLabel: (CFG.HANDOFF_LABEL || '').trim() || undefined,
        ...(registryId && HEX64.test(registryId)
            ? {
                  einsatzManifestRegistryId: registryId,
                  einsatzManifestRegistryIdMasked: mask(registryId),
              }
            : {}),
        ...(mainnetPkg && HEX64.test(mainnetPkg)
            ? {
                  mainnetPackageId: mainnetPkg,
                  mainnetPackageIdMasked: mask(mainnetPkg),
              }
            : {}),
        ...(mainnetRpc
            ? {
                  mainnetRpcUrlLabel: rpcUrlLabel(mainnetRpc),
                  ...(exposeRpc ? { mainnetRpcUrl: mainnetRpc } : {}),
              }
            : {}),
        registryConfigured: Boolean(registryId && HEX64.test(registryId)),
        mainnetPackageConfigured: Boolean(mainnetPkg && HEX64.test(mainnetPkg)),
    };
}

export async function handleEinsatzManifestRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>,
    sendJson: SendJsonFn
): Promise<boolean> {
    if (req.method !== 'GET') return false;

    const query = parseRequestQuery(req);

    if (url === '/api/einsatz-manifest/config') {
        if (denyIfUnauthorized(res, cors, sendJson)) return true;
        sendJson(res, 200, manifestConfigPayload(query), cors);
        return true;
    }

    if (url === '/api/einsatz-manifest/anchors') {
        if (denyIfUnauthorized(res, cors, sendJson)) return true;

        const registryId = (CFG.EINSATZ_MANIFEST_REGISTRY_ID || '').trim();
        const mainnetPkg = resolveMainnetPackageId();
        if (!HEX64.test(registryId)) {
            sendJson(
                res,
                400,
                { ok: false, error: 'EINSATZ_MANIFEST_REGISTRY_ID fehlt oder ungültig.' },
                cors
            );
            return true;
        }
        if (!mainnetPkg) {
            sendJson(res, 400, { ok: false, error: 'MAINNET_PACKAGE_ID bzw. PACKAGE_ID fehlt.' }, cors);
            return true;
        }

        const ctx = resolveEinsatzContext(query);
        try {
            const client = createDirectIotaClient({ rpcUrl: resolveMainnetRpcUrl() });
            const rows: EinsatzManifestAnchorRow[] = await fetchEinsatzManifestAnchorsForEinsatz(client, {
                packageId: mainnetPkg,
                registryObjectId: registryId,
                einsatzIdMoveAddress: ctx.einsatzIdMoveAddress,
            });
            sendJson(
                res,
                200,
                {
                    ok: true,
                    einsatzIdUtf8: ctx.einsatzIdUtf8,
                    einsatzIdMoveAddress: ctx.einsatzIdMoveAddress,
                    rows,
                },
                cors
            );
        } catch (e: unknown) {
            sendJson(res, 502, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/einsatz-manifest/probe') {
        if (denyIfUnauthorized(res, cors, sendJson)) return true;

        const registryId = (CFG.EINSATZ_MANIFEST_REGISTRY_ID || '').trim();
        const mainnetPkg = resolveMainnetPackageId();
        if (!HEX64.test(registryId)) {
            sendJson(
                res,
                400,
                { ok: false, error: 'EINSATZ_MANIFEST_REGISTRY_ID fehlt oder ungültig.' },
                cors
            );
            return true;
        }
        if (!mainnetPkg) {
            sendJson(res, 400, { ok: false, error: 'Package-ID für Mainnet-Probe fehlt.' }, cors);
            return true;
        }

        const seqRaw = query.get('sequence');
        const sequence = Number(seqRaw);
        if (!Number.isFinite(sequence) || sequence < 0) {
            sendJson(res, 400, { ok: false, error: 'Query-Parameter sequence fehlt oder ungültig.' }, cors);
            return true;
        }

        const ctx = resolveEinsatzContext(query);
        try {
            const client = createDirectIotaClient({ rpcUrl: resolveMainnetRpcUrl() });
            const exists = await probeEinsatzManifestAnchorOnChain(client, {
                packageId: mainnetPkg,
                registryObjectId: registryId,
                einsatzIdMoveAddress: ctx.einsatzIdMoveAddress,
                sequence: BigInt(Math.max(0, Math.floor(sequence))),
            });
            sendJson(
                res,
                200,
                {
                    ok: true,
                    exists,
                    sequence: Math.floor(sequence),
                    einsatzIdUtf8: ctx.einsatzIdUtf8,
                    einsatzIdMoveAddress: ctx.einsatzIdMoveAddress,
                },
                cors
            );
        } catch (e: unknown) {
            sendJson(res, 502, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    return false;
}
