/**
 * Idempotenz: jedes Stripe-Webhook-Event (evt_…) höchstens einmal verarbeiten.
 */
import fs from 'node:fs';
import path from 'node:path';

const STATE_FILE = path.join(process.cwd(), '.morgendrot-shop-stripe-events.json');

type EvFile = { version: 1; processed: Record<string, { at: string }> };

let mutex = Promise.resolve();

function loadState(): EvFile {
    try {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const p = JSON.parse(raw) as EvFile;
        if (p.version !== 1 || !p.processed || typeof p.processed !== 'object') throw new Error('invalid');
        return p;
    } catch {
        return { version: 1, processed: {} };
    }
}

function saveState(s: EvFile): void {
    fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
}

export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
    const id = String(eventId || '').trim();
    if (!id) return false;
    const run = mutex.then(() => {
        const s = loadState();
        return Boolean(s.processed[id]);
    });
    mutex = run.then(
        () => {},
        () => {}
    );
    return run;
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
    const id = String(eventId || '').trim();
    if (!id) return;
    const run = mutex.then(() => {
        const s = loadState();
        if (s.processed[id]) return;
        s.processed[id] = { at: new Date().toISOString() };
        saveState(s);
    });
    mutex = run.then(
        () => {},
        () => {}
    );
    return run;
}
