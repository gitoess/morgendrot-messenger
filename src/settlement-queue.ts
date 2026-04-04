/**
 * Deferred-Settlement-Queue: Offline-Bestätigungen (use_ticket) persistent speichern
 * und asynchron per Batch-PTB on-chain bringen. Non-blocking für UI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CFG } from './config.js';
import { logger } from './logger.js';
import { batchUseTickets, type UseTicketEntry } from './chain-access.js';
import { getWalletPassword } from './wallet-bridge.js';

export type SettlementEntry = {
    id: string;
    ticketObjectId: string;
    eventId: string;
    deviceId?: string;
    timestamp: number;
};

const DEFAULT_QUEUE_FILE = '.morgendrot-settlement-queue.jsonl';
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_INTERVAL_MS = 15_000;
const MAX_RETRIES = 5;
const RETRY_BACKOFF_MS = 5_000;

let workerTimer: ReturnType<typeof setInterval> | null = null;
let lastErrorAt = 0;
let consecutiveFailures = 0;

function getQueuePath(): string {
    return path.resolve(process.cwd(), CFG.SETTLEMENT_QUEUE_FILE || DEFAULT_QUEUE_FILE);
}

/** Liest alle Einträge aus der Queue-Datei (eine Zeile = ein JSON-Objekt). */
function readAllEntries(filePath: string): SettlementEntry[] {
    try {
        if (!fs.existsSync(filePath)) return [];
        const raw = fs.readFileSync(filePath, 'utf-8');
        const lines = raw.split(/\r?\n/).filter((s) => s.trim());
        const entries: SettlementEntry[] = [];
        for (const line of lines) {
            try {
                const o = JSON.parse(line) as SettlementEntry;
                if (o?.id && o?.ticketObjectId && o?.eventId) entries.push(o);
            } catch {
                // ungültige Zeile überspringen
            }
        }
        return entries;
    } catch (e) {
        logger.warn('Settlement-Queue lesen: ' + (e as Error)?.message);
        return [];
    }
}

/** Schreibt Einträge zurück in die Datei (nach Entfernen abgearbeiteter). */
function writeEntries(filePath: string, entries: SettlementEntry[]): void {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const content = entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '');
        fs.writeFileSync(filePath, content, 'utf-8');
    } catch (e) {
        logger.warn('Settlement-Queue schreiben: ' + (e as Error)?.message);
    }
}

/** Hängt einen Eintrag an die Queue an (wird vom Gateway bei Offline-Bestätigung aufgerufen). */
export function appendSettlementEntry(entry: Omit<SettlementEntry, 'id' | 'timestamp'>): string {
    const filePath = getQueuePath();
    const full: SettlementEntry = {
        ...entry,
        id: randomUUID(),
        timestamp: Date.now(),
    };
    try {
        fs.appendFileSync(filePath, JSON.stringify(full) + '\n', 'utf-8');
        return full.id;
    } catch (e) {
        logger.warn('Settlement-Queue append: ' + (e as Error)?.message);
        throw e;
    }
}

/** Liest bis zu max Enträge aus der Queue (älteste zuerst). */
export function readSettlementBatch(max: number = DEFAULT_BATCH_SIZE): SettlementEntry[] {
    const filePath = getQueuePath();
    const all = readAllEntries(filePath);
    return all.slice(0, max);
}

/** Entfernt Einträge mit den angegebenen IDs aus der Queue. */
export function removeSettlementEntries(ids: string[]): void {
    if (ids.length === 0) return;
    const filePath = getQueuePath();
    const all = readAllEntries(filePath);
    const idSet = new Set(ids);
    const remaining = all.filter((e) => !idSet.has(e.id));
    if (remaining.length === all.length) return;
    writeEntries(filePath, remaining);
}

/** Ein Zyklus: Batch lesen, PTB ausführen, bei Erfolg entfernen. Non-blocking, keine Blockierung des Event-Loops. */
async function runSettlementCycle(): Promise<void> {
    const filePath = getQueuePath();
    const batchSize = Math.max(1, CFG.SETTLEMENT_QUEUE_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
    const signingAddress = CFG.MY_ADDRESS;
    const walletPassword = getWalletPassword();
    if (!signingAddress || !walletPassword) {
        return; // Kein Wallet geladen – still beenden
    }
    const entries = readSettlementBatch(batchSize);
    if (entries.length === 0) return;

    const useTicketEntries: UseTicketEntry[] = entries.map((e) => ({
        ticketObjectId: e.ticketObjectId,
        eventId: e.eventId,
        ...(e.deviceId ? { deviceOriginId: e.deviceId } : {}),
    }));
    try {
        const res = await batchUseTickets(useTicketEntries, signingAddress, walletPassword);
        if (res?.status === 'failure') {
            throw new Error('PTB status failure');
        }
        consecutiveFailures = 0;
        removeSettlementEntries(entries.map((e) => e.id));
        logger.info(`Settlement-Queue: ${entries.length} Bestätigung(en) on-chain (Digest: ${res?.digest?.slice(0, 16) ?? '–'}…).`);
    } catch (e) {
        consecutiveFailures++;
        lastErrorAt = Date.now();
        const backoff = Math.min(RETRY_BACKOFF_MS * Math.pow(2, consecutiveFailures - 1), 120_000);
        logger.warn(
            `Settlement-Queue: Batch fehlgeschlagen (${entries.length} Einträge), Retry in ${backoff / 1000}s. ` + (e as Error)?.message
        );
        // Kein remove – Einträge bleiben für nächsten Zyklus
    }
}

/** Startet den asynchronen Hintergrund-Worker (intervallbasiert). Stoppt nicht den Event-Loop. */
export function startSettlementWorker(): void {
    if (!CFG.SETTLEMENT_QUEUE_ENABLED) return;
    const intervalMs = Math.max(5000, CFG.SETTLEMENT_QUEUE_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
    if (workerTimer) return;
    logger.info(`Settlement-Worker gestartet: alle ${intervalMs / 1000}s, Queue: ${getQueuePath()}`);
    workerTimer = setInterval(() => {
        void runSettlementCycle();
    }, intervalMs);
}

/** Stoppt den Worker (z. B. beim Shutdown). */
export function stopSettlementWorker(): void {
    if (workerTimer) {
        clearInterval(workerTimer);
        workerTimer = null;
        logger.info('Settlement-Worker gestoppt.');
    }
}
