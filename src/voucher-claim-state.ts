/**
 * Idempotenter Claim-Token-Verbrauch für Shop-E-Mail-Links (Schicht vor Burn/Mint).
 * Zustand: .morgendrot-voucher-claim-state.json (nur SHA-256-Keys, kein Klartext-Token).
 * Siehe docs/API-VOUCHER-CLAIM-SPEC.md
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STATE_FILE = path.join(process.cwd(), '.morgendrot-voucher-claim-state.json');

type ClaimStateFile = { version: 1; consumed: Record<string, { at: string }> };

/** Serialisiert Lese/Schreib-Zugriffe (Doppelklick = eine Entscheidung). */
let mutex = Promise.resolve();

function loadState(): ClaimStateFile {
    try {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const p = JSON.parse(raw) as ClaimStateFile;
        if (p.version !== 1 || !p.consumed || typeof p.consumed !== 'object') throw new Error('invalid');
        return p;
    } catch {
        return { version: 1, consumed: {} };
    }
}

function saveState(s: ClaimStateFile): void {
    fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
}

/** SHA-256 des Tokens — Datei enthält nur diesen Key, nicht den Klartext. */
export function hashClaimToken(token: string): string {
    return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

export type ConsumeClaimTokenResult = {
    status: 'consumed' | 'already_consumed';
    /** Erste 16 Hex-Zeichen des Token-Hashes — für Logs/Support. */
    claimKeyPrefix: string;
    consumedAt: string;
};

/**
 * Markiert Token als verbraucht. Zweiter Aufruf mit demselben Token: `already_consumed`, gleiches `consumedAt`.
 */
export function consumeClaimTokenOnce(token: string): Promise<ConsumeClaimTokenResult> {
    const t = String(token || '').trim();
    if (t.length < 16 || t.length > 2048) {
        return Promise.reject(new Error('claimToken: Länge 16–2048 Zeichen'));
    }
    const key = hashClaimToken(t);
    const prefix = key.slice(0, 16);

    const run = mutex.then((): ConsumeClaimTokenResult => {
        const s = loadState();
        if (s.consumed[key]) {
            return {
                status: 'already_consumed',
                claimKeyPrefix: prefix,
                consumedAt: s.consumed[key].at,
            };
        }
        const now = new Date().toISOString();
        s.consumed[key] = { at: now };
        saveState(s);
        return {
            status: 'consumed',
            claimKeyPrefix: prefix,
            consumedAt: now,
        };
    });
    mutex = run.then(
        () => {},
        () => {}
    );
    return run;
}
