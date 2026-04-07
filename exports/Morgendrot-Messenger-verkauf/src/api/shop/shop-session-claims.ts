/**
 * Serverseitige Zuordnung Stripe Checkout Session → Claim-Token (nach Zahlung).
 * Datei nur auf dem Fulfillment-Host; nicht committen (.gitignore).
 */
import fs from 'node:fs';
import path from 'node:path';

const STATE_FILE = path.join(process.cwd(), '.morgendrot-shop-session-claims.json');

export type ShopSessionClaimRow = {
    claimToken: string;
    issuedAt: string;
    productId: string;
    stripeEventId: string;
    /** Gesetzt nach erfolgreichem mint_messenger_credits_batch (Idempotenz bei Stripe-Retry). */
    mintTxDigest?: string;
};

type ClaimFile = { version: 1; sessions: Record<string, ShopSessionClaimRow> };

let mutex = Promise.resolve();

function loadState(): ClaimFile {
    try {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const p = JSON.parse(raw) as ClaimFile;
        if (p.version !== 1 || !p.sessions || typeof p.sessions !== 'object') throw new Error('invalid');
        return p;
    } catch {
        return { version: 1, sessions: {} };
    }
}

function saveState(s: ClaimFile): void {
    fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
}

export async function getShopSessionClaim(sessionId: string): Promise<ShopSessionClaimRow | null> {
    const sid = String(sessionId || '').trim();
    if (!sid) return null;
    const run = mutex.then(() => {
        const s = loadState();
        return s.sessions[sid] || null;
    });
    mutex = run.then(
        () => {},
        () => {}
    );
    return run;
}

/**
 * Legt Claim nur an, wenn Session noch unbekannt — idempotent bei Webhook-Retry.
 */
export async function putShopSessionClaimIfAbsent(
    sessionId: string,
    row: ShopSessionClaimRow
): Promise<{ row: ShopSessionClaimRow; created: boolean }> {
    const sid = String(sessionId || '').trim();
    if (!sid) return Promise.reject(new Error('sessionId fehlt'));

    const run = mutex.then((): { row: ShopSessionClaimRow; created: boolean } => {
        const s = loadState();
        if (s.sessions[sid]) {
            return { row: s.sessions[sid], created: false };
        }
        s.sessions[sid] = row;
        saveState(s);
        return { row, created: true };
    });
    mutex = run.then(
        () => {},
        () => {}
    );
    return run;
}

export async function updateShopSessionClaimMintTx(sessionId: string, mintTxDigest: string): Promise<void> {
    const sid = String(sessionId || '').trim();
    const dig = String(mintTxDigest || '').trim();
    if (!sid || !dig) return;

    const run = mutex.then(() => {
        const s = loadState();
        const row = s.sessions[sid];
        if (!row) return;
        row.mintTxDigest = dig;
        saveState(s);
    });
    mutex = run.then(
        () => {},
        () => {}
    );
    return run;
}
