/**
 * Gas Station – automatisches Nachfüllen von IOTA für Worker-Adressen (Boss-Modus).
 * Prüft periodisch WORKER_ADDRESSES; wenn Saldo unter GAS_STATION_MIN_IOTA: Überweisung GAS_STATION_TOPUP_IOTA.
 * Siehe docs/INDUSTRY-FEATURES.md.
 *
 * Hinweis: Das ist NICHT die „IOTA Gas Station“ aus Netzwerk-/Sponsor-Blog-Doku (Package-Filter, PTB-Limits).
 * Begriffe: docs/SPONSORING-AND-CREDITS-DOUBLE-FLOOR.md §0.
 */
import { CFG } from './config.js';
import { getBalanceInMist, transferCoins, iotaToMist } from './chain-access.js';
import { logger } from './logger.js';

export type GasStationResult = {
    toppedUp: string[];
    skipped: string[];
    errors: string[];
};

/**
 * Führt einen einzelnen Gas-Station-Lauf durch: alle Worker prüfen, bei Bedarf nachfüllen.
 * Nur aufrufen, wenn ROLE=boss und GAS_STATION_ENABLED (Aufrufer prüft das).
 */
export async function runGasStationCheck(
    bossAddress: string,
    getPassword: () => string | undefined
): Promise<GasStationResult> {
    const workers = [...(CFG.WORKER_ADDRESSES || [])];
    const minMist = iotaToMist(String(CFG.GAS_STATION_MIN_IOTA));
    const topupMist = iotaToMist(String(CFG.GAS_STATION_TOPUP_IOTA));
    const result: GasStationResult = { toppedUp: [], skipped: [], errors: [] };

    if (workers.length === 0) return result;

    for (const worker of workers) {
        try {
            const balance = await getBalanceInMist(worker);
            if (balance < minMist) {
                const pw = getPassword();
                if (!pw) {
                    result.errors.push(`${worker}: Wallet nicht entsperrt – kein Nachfüllen`);
                    continue;
                }
                await transferCoins(worker, topupMist, bossAddress, pw);
                result.toppedUp.push(worker);
                logger.info(`Gas Station: ${worker.slice(0, 14)}… nachgefüllt (${CFG.GAS_STATION_TOPUP_IOTA} IOTA).`);
            } else {
                result.skipped.push(worker);
            }
        } catch (e) {
            const msg = (e as Error)?.message || String(e);
            result.errors.push(`${worker}: ${msg}`);
            logger.warn('Gas Station: ' + msg);
        }
    }
    return result;
}
