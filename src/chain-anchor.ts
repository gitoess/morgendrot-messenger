/**
 * Chain-Anchor: Hash des aktuellen Zustands periodisch on-chain signieren.
 * Nur für Messenger (hat Signatur). Lock signiert nicht.
 */
import { createHash } from 'node:crypto';
import { CFG } from './config.js';
import { logger } from './logger.js';
import { getClient, storePlaintextMessage } from './chain-access.js';
import { loadReplayState } from './replay-state.js';

/** Erzeugt SHA-256-Hash des Zustands. */
function hashState(state: Record<string, unknown>): string {
    const json = JSON.stringify(state, Object.keys(state).sort());
    return createHash('sha256').update(json).digest('hex');
}

/** Sendet Zustands-Hash als Klartext an sich selbst (on-chain Anchor). */
export async function anchorState(
    myAddress: string,
    extraState?: Record<string, unknown>,
    walletPassword?: string
): Promise<{ digest?: string } | null> {
    if (!CFG.ENABLE_CHAIN_ANCHOR || !CFG.PACKAGE_ID) return null;
    try {
        const replayPath = CFG.REPLAY_STATE_FILE || '';
        const replay = replayPath ? await loadReplayState(replayPath) : {};
        const state = {
            ts: Date.now(),
            replay,
            ...extraState,
        };
        const h = hashState(state);
        const payload = `ANCHOR:${h}`;
        const nonce = BigInt(Date.now());
        const textBytes = new TextEncoder().encode(payload);
        const result = await storePlaintextMessage(myAddress, myAddress, textBytes, nonce, walletPassword);
        if (CFG.LOG_VERBOSE) logger.info('Chain-Anchor: ' + h.slice(0, 16) + '…');
        return result;
    } catch (e) {
        logger.warn('Chain-Anchor fehlgeschlagen: ' + (e as Error)?.message);
        return null;
    }
}

/** Startet periodischen Anchor-Interval. */
export function startAnchorLoop(
    myAddress: string,
    walletPassword?: string,
    extraState?: () => Record<string, unknown>
): void {
    if (!CFG.ENABLE_CHAIN_ANCHOR) return;
    const ms = Math.max(3600000, CFG.ANCHOR_INTERVAL_MS);
    logger.info(`Chain-Anchor aktiv: alle ${ms / 3600000} h.`);
    const run = () => anchorState(myAddress, extraState?.(), walletPassword);
    run();
    setInterval(run, ms);
}
