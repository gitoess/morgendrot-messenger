/**
 * Move messaging-Modul: welche Entry-Funktionen im deployten Package stecken (RPC-Probe, gecacht).
 * Für Boss „Einsatz-Konfiguration“ / GET /api/status → einsatzConfig.moveFeatures.
 */
import { getClient } from './chain-access.js';

export type MessagingMoveFeatures = {
    teamBroadcastStore: boolean;
    teamBroadcastPurge: boolean;
    teamEncryptedBroadcastStore: boolean;
    teamEncryptedBroadcastPurge: boolean;
    privateMailboxPurge: boolean;
    /** true wenn RPC-Modul gelesen wurde */
    probed: boolean;
    error?: string;
};

const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { at: number; data: MessagingMoveFeatures }>();

export async function getMessagingMoveFeatures(packageId: string): Promise<MessagingMoveFeatures> {
    const pkg = String(packageId || '').trim();
    const pkgKey = pkg.toLowerCase();
    if (!/^0x[a-fA-F0-9]{64}$/.test(pkg)) {
        return {
            teamBroadcastStore: false,
            teamBroadcastPurge: false,
            teamEncryptedBroadcastStore: false,
            teamEncryptedBroadcastPurge: false,
            privateMailboxPurge: false,
            probed: false,
            error: 'Keine gültige PACKAGE_ID',
        };
    }
    const hit = cache.get(pkgKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

    const fallback: MessagingMoveFeatures = {
        teamBroadcastStore: false,
        teamBroadcastPurge: false,
        teamEncryptedBroadcastStore: false,
        teamEncryptedBroadcastPurge: false,
        privateMailboxPurge: false,
        probed: false,
    };

    try {
        const client = getClient();
        type ExposedFn = { name: string };
        const getModule = (client as unknown as {
            getNormalizedMoveModule?: (p: { package: string; module: string }) => Promise<{
                exposedFunctions?: ExposedFn[];
            }>;
        }).getNormalizedMoveModule;
        if (typeof getModule !== 'function') {
            const data: MessagingMoveFeatures = { ...fallback, error: 'RPC: getNormalizedMoveModule nicht verfügbar' };
            cache.set(pkgKey, { at: Date.now(), data });
            return data;
        }
        const mod = await getModule.call(client, { package: pkg, module: 'messaging' });
        const names = new Set((mod?.exposedFunctions ?? []).map((f) => f.name));
        const data: MessagingMoveFeatures = {
            teamBroadcastStore: names.has('store_team_plaintext_broadcast'),
            teamBroadcastPurge: names.has('purge_team_plaintext_broadcast'),
            teamEncryptedBroadcastStore: names.has('store_team_encrypted_broadcast'),
            teamEncryptedBroadcastPurge: names.has('purge_team_encrypted_broadcast'),
            privateMailboxPurge: names.has('purge_private_mailbox'),
            probed: true,
        };
        cache.set(pkgKey, { at: Date.now(), data });
        return data;
    } catch (e: unknown) {
        const data: MessagingMoveFeatures = {
            ...fallback,
            error: e instanceof Error ? e.message : String(e),
        };
        cache.set(pkgKey, { at: Date.now(), data });
        return data;
    }
}

/** Nach Move-Upgrade Cache leeren (Move-Funktions-Probe). */
export function invalidateMessagingMoveFeaturesCache(packageId?: string): void {
    if (packageId?.trim()) {
        cache.delete(packageId.trim().toLowerCase());
        return;
    }
    cache.clear();
}
