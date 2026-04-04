/**
 * IOTA Names über Indexer-RPC (iotax_iotaNamesLookup).
 * @see https://docs.iota.org/iota-api-ref#iotax_iotanameslookup
 *
 * Liefert u. a. targetAddress + nftId (Registrierungs-NFT). Das NFT-Typ-Paket kann mit
 * VERIFIED_IOTA_NAME_PACKAGE_IDS gegen eine Allowlist geprüft werden (Partner-/Boss-Modelle).
 */
import type { IotaClient } from '@iota/iota-sdk/client';

export type IotaNameLookupRecord = {
    nftId: string;
    targetAddress: string | null;
    expirationTimestampMs?: string | number;
    data?: unknown;
};

type JsonRpcOk = { result: IotaNameLookupRecord };
type JsonRpcErr = { error: { code: number; message: string } };

function normalizePackageIdForTypeMatch(pkg: string): string {
    const p = String(pkg || '').trim().toLowerCase();
    return p.startsWith('0x') ? p : `0x${p}`;
}

/**
 * JSON-RPC iotax_iotaNamesLookup (params: { name }).
 * name z. B. "meinname.iota"
 */
export async function iotaNamesLookup(
    rpcUrl: string,
    name: string,
    fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): Promise<IotaNameLookupRecord> {
    const url = String(rpcUrl || '').trim().replace(/\/$/, '');
    const n = String(name || '').trim();
    if (!url) throw new Error('RPC_URL fehlt.');
    if (!n) throw new Error('Name fehlt (z. B. beispiel.iota).');
    const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'iotax_iotaNamesLookup',
            params: { name: n },
        }),
    });
    const json = (await res.json()) as JsonRpcOk | JsonRpcErr;
    if ('error' in json && json.error) {
        throw new Error(json.error.message || String(json.error.code));
    }
    const r = (json as JsonRpcOk).result;
    if (!r || typeof r !== 'object' || !r.nftId) {
        throw new Error('Unerwartete Antwort (kein nftId).');
    }
    return r;
}

/**
 * Prüft, ob das Registrierungs-NFT-Typ mit einem der erlaubten Package-IDs beginnt
 * (Move-Typ: `<package>::module::Struct`).
 */
export async function registrationNftMatchesAllowedPackages(
    client: IotaClient,
    nftObjectId: string,
    allowedPackageIds: string[]
): Promise<{ matches: boolean; objectType?: string }> {
    const oid = String(nftObjectId || '').trim();
    const allow = allowedPackageIds.map(normalizePackageIdForTypeMatch).filter((p) => /^0x[a-f0-9]{64}$/.test(p));
    if (!allow.length || !/^0x[a-fA-F0-9]{64}$/i.test(oid)) return { matches: false };
    try {
        const res = await client.getObject({
            id: oid,
            options: { showType: true },
        } as Parameters<IotaClient['getObject']>[0]);
        const typ = String((res as { data?: { type?: string } })?.data?.type || '').trim().toLowerCase();
        if (!typ) return { matches: false };
        const matches = allow.some((pkg) => typ.startsWith(pkg + '::'));
        return { matches, objectType: typ };
    } catch {
        return { matches: false };
    }
}
