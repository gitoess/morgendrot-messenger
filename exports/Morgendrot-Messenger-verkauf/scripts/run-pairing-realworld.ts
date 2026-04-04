/**
 * Geheimnis-Peering (optional) – Real-World gegen zwei laufende APIs.
 *
 * Ablauf: A /pairing-offer → A /pairing-wait → B /pairing-find → B /connect (Partner-Datei).
 * Env: API_BASE_A, API_BASE_B (optional), UNLOCK_PASSWORD (optional), PAIRING_SECRET (optional, Default testgeheim-123456).
 *
 * Voraussetzung: Zwei Instanzen, unterschiedliche MY_ADDRESS, gleiche PACKAGE_ID/RPC,
 * Move-Paket mit emit_pairing_offer. Nicht bereits „verbunden“ für sauberen Lauf.
 *
 * Aufruf: npm run test:pairing
 */

const API_A = process.env.API_BASE_A || 'http://127.0.0.1:3342';
const API_B = process.env.API_BASE_B || 'http://127.0.0.1:3343';
const UNLOCK_PASSWORD = process.env.UNLOCK_PASSWORD || '';
const PAIRING_SECRET = (process.env.PAIRING_SECRET || 'rwmsg-peer-test-9').trim();

async function apiGet(base: string, path: string): Promise<unknown> {
    const res = await fetch(`${base}${path}`, { method: 'GET' });
    const text = await res.text();
    if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${text}`);
    return text ? JSON.parse(text) : {};
}

async function apiPost(base: string, path: string, body: object): Promise<unknown> {
    const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(`POST ${path}: ${res.status} ${JSON.stringify(data)}`);
    return data;
}

type CommandResult = { ok?: boolean; message?: string; error?: string };
async function command(base: string, cmd: string, args: string[]): Promise<CommandResult> {
    return apiPost(base, '/api/command', { cmd, args }) as Promise<CommandResult>;
}

function isUnknownCommand(r: CommandResult): boolean {
    return /\bUnbekannter Befehl\b/i.test(String(r.message || r.error || ''));
}

function log(step: string, ok: boolean, detail?: string) {
    const s = ok ? 'OK' : 'FAIL';
    console.log(`  [${s}] ${step}${detail ? ' – ' + detail : ''}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitConnected(base: string, label: string, maxMs: number): Promise<boolean> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
        const st = (await apiGet(base, '/api/status').catch(() => ({}))) as { connected?: boolean };
        if (st.connected === true) return true;
        await sleep(1500);
    }
    console.error(`  Timeout: ${label} nicht verbunden nach ${Math.round(maxMs / 1000)}s`);
    return false;
}

async function main() {
    console.log('\n=== Geheimnis-Peering (Real-World) ===\n');
    console.log('A:', API_A);
    console.log('B:', API_B);
    console.log('Geheimnis-Länge:', PAIRING_SECRET.length, '(min. 6 Zeichen)\n');

    if (PAIRING_SECRET.length < 6) {
        console.error('PAIRING_SECRET zu kurz (min. 6).');
        process.exit(1);
    }

    let addrA: string;
    let addrB: string;
    try {
        const idsA = (await apiGet(API_A, '/api/current-ids')) as { myAddress?: string };
        const idsB = (await apiGet(API_B, '/api/current-ids')) as { myAddress?: string };
        addrA = idsA.myAddress || '';
        addrB = idsB.myAddress || '';
        if (!addrA || !addrB) throw new Error('Beide APIs brauchen MY_ADDRESS (/api/current-ids).');
    } catch (e) {
        console.error('APIs nicht erreichbar oder ohne MY_ADDRESS. Zwei Server starten (z. B. Port 3342 und 3343).', e);
        process.exit(1);
    }

    if (addrA === addrB) {
        console.error('A und B haben dieselbe Adresse – Peering braucht zwei Wallets.');
        process.exit(1);
    }

    console.log('Alice (A):', addrA.slice(0, 18) + '…');
    console.log('Bob (B):  ', addrB.slice(0, 18) + '…\n');

    if (UNLOCK_PASSWORD) {
        try {
            await apiPost(API_A, '/api/unlock', { password: UNLOCK_PASSWORD });
            log('A: unlock', true);
        } catch (e: unknown) {
            log('A: unlock', false, String((e as Error)?.message || e));
        }
        try {
            await apiPost(API_B, '/api/unlock', { password: UNLOCK_PASSWORD });
            log('B: unlock', true);
        } catch (e: unknown) {
            log('B: unlock', false, String((e as Error)?.message || e));
        }
    } else {
        console.log('(UNLOCK_PASSWORD nicht gesetzt – Wallets in der UI entsperren.)\n');
    }

    const sa = (await apiGet(API_A, '/api/status').catch(() => ({}))) as { connected?: boolean };
    const sb = (await apiGet(API_B, '/api/status').catch(() => ({}))) as { connected?: boolean };
    if (sa.connected || sb.connected) {
        console.log('Hinweis: Mindestens eine Seite ist schon „verbunden“. Für einen sauberen Peering-Lauf ggf. neu starten oder Session leeren.\n');
    }

    const cA = await command(API_A, '/cancel-connect', []);
    log('A: /cancel-connect', cA.ok === true, cA.message || cA.error || '');
    const cB = await command(API_B, '/cancel-connect', []);
    log(
        'B: /cancel-connect',
        cB.ok === true || isUnknownCommand(cB),
        isUnknownCommand(cB) ? 'ohne Befehl (alte Version) – OK' : cB.message || cB.error || ''
    );
    await sleep(2000);

    console.log('--- Peering ---');
    const offer = await command(API_A, '/pairing-offer', [PAIRING_SECRET, 'PairingRW', '120']);
    log('A: /pairing-offer', offer.ok === true, offer.message || offer.error || '');

    const waitCmd = await command(API_A, '/pairing-wait', []);
    log('A: /pairing-wait', waitCmd.ok === true, waitCmd.message || waitCmd.error || '');

    await sleep(10_000);

    const find = await command(API_B, '/pairing-find', [PAIRING_SECRET]);
    log('B: /pairing-find', find.ok === true, find.message || find.error || '');

    const aOk = await waitConnected(API_A, 'Alice', 120_000);
    log('A: Status connected', aOk);

    const connectB = await command(API_B, '/connect', []);
    log('B: /connect (Partner aus Datei)', connectB.ok === true, connectB.message || connectB.error || '');

    const bOk = await waitConnected(API_B, 'Bob', 120_000);
    log('B: Status connected', bOk);

    const ok = Boolean(
        offer.ok === true &&
            waitCmd.ok === true &&
            find.ok === true &&
            aOk &&
            connectB.ok === true &&
            bOk
    );
    console.log(ok ? '\n=== Peering: ERFOLG ===\n' : '\n=== Peering: prüfen (siehe FAIL oben) ===\n');
    process.exit(ok ? 0 : 1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
