/**
 * Replay-Schutz für OPEN-Befehle: speichert die zuletzt akzeptierte Nonce pro Sender.
 * Ohne Persistenz könnten alte "OPEN"-Nachrichten nach Neustart erneut ausgeführt werden.
 * Sicherheit: Datei wird nach Schreiben mit chmod 600 geschützt (nur Eigentümer lesbar/schreibbar).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import { logger } from './logger.js';

export type ReplayState = Record<string, string>; // sender -> last accepted nonce (bigint as string)

const defaultState: ReplayState = {};

export async function loadReplayState(filePath: string): Promise<ReplayState> {
    try {
        const raw = await readFile(filePath, 'utf-8');
        const data = JSON.parse(raw) as ReplayState;
        return typeof data === 'object' && data !== null ? data : { ...defaultState };
    } catch {
        return { ...defaultState };
    }
}

export async function saveReplayState(filePath: string, state: ReplayState): Promise<void> {
    try {
        const dir = dirname(filePath);
        await mkdir(dir, { recursive: true });
        await writeFile(filePath, JSON.stringify(state, null, 0), 'utf-8');
        await chmod(filePath, 0o600).catch(() => {}); // Nur Eigentümer lesbar/schreibbar (Unix)
    } catch (e) {
        logger.warn('Replay-State speichern fehlgeschlagen: ' + (e as Error)?.message);
    }
}

/** Prüft, ob nonce für sender neu genug ist (monoton steigend) und aktualisiert den State. */
export function acceptAndUpdate(
    state: ReplayState,
    sender: string,
    nonce: bigint
): { accepted: boolean; newState: ReplayState } {
    const last = state[sender];
    const lastNonce = last === undefined ? -1n : BigInt(last);
    if (nonce <= lastNonce) return { accepted: false, newState: state };
    const newState = { ...state, [sender]: String(nonce) };
    return { accepted: true, newState };
}
