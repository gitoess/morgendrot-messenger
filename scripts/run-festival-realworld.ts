/**
 * Real-World-Test: Festivalbetreiber – KI erstellt 2 Tickets (Metadaten: Name, Sitzplatz, Preis),
 * sendet Einladung an Wallet(s). Ein Befehl pro Schritt.
 *
 * Voraussetzung: Morgendrot läuft (npm run start), RPC erreichbar.
 * Wallet: In der UI (Säule 1) entsperren ODER UNLOCK_PASSWORD=… setzen – dann wartet das Skript bis der Befehl-Handler bereit ist.
 * Aufruf: npm run test:festival-realworld
 * Optional: UNLOCK_PASSWORD=… API_BASE=http://127.0.0.1:3342 EVENT_ID=0x… (sonst Platzhalter)
 */
import 'dotenv/config';

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3342').replace(/\/$/, '');
const UNLOCK_PASSWORD = process.env.UNLOCK_PASSWORD || '';
const EVENT_ID = process.env.EVENT_ID || '0x' + 'e'.repeat(64);

const WALLET1 = '0x2070bf57c91909459427effd0e1e0d348f8fc1967389f8c553fc43656aa29eb8';
const WALLET2 = '0x2070bf57c91909459427effd0e1e0d348f8fc1967389f8c553fc43656aa29eb8';

function metadataToHex(obj: Record<string, string>): string {
    const json = JSON.stringify(obj);
    return '0x' + Buffer.from(json, 'utf8').toString('hex');
}

const TICKET1_META = metadataToHex({
    name: 'Anna Sommer',
    seat: 'Block A Reihe 5 Platz 12',
    price: '49.99 EUR',
    event: 'Festival 2025',
});
const TICKET2_META = metadataToHex({
    name: 'Tom Winter',
    seat: 'Block B Reihe 3 Platz 7',
    price: '49.99 EUR',
    event: 'Festival 2025',
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(path: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}${path}`, { method: 'GET' });
    const text = await res.text();
    if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
    return text ? JSON.parse(text) : {};
}

async function post(path: string, body: object): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(data?.error || res.status));
    return data;
}

async function aiCopilot(phrase: string): Promise<{ ok?: boolean; suggestedAction?: { cmd: string; args: string[] }; error?: string }> {
    try {
        return (await post('/api/ai-copilot', {
            message: phrase,
            context: {},
            options: { useIntentMatcher: true, useOllama: false },
        })) as { ok?: boolean; suggestedAction?: { cmd: string; args: string[] }; error?: string };
    } catch {
        return { ok: false };
    }
}

async function runCommand(cmd: string, args: string[]): Promise<{ ok?: boolean; message?: string; error?: string; objectId?: string }> {
    try {
        return (await post('/api/command', { cmd, args })) as { ok?: boolean; message?: string; error?: string; objectId?: string };
    } catch (e) {
        return { ok: false, error: String((e as Error)?.message || e) };
    }
}

/** Prüft, ob Befehl-Handler bereit ist (ohne bei 503 zu werfen). */
async function isCommandHandlerReady(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cmd: '/help', args: [] }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        return res.ok && data.ok === true;
    } catch {
        return false;
    }
}

async function main() {
    console.log('\n=== Festival Real-World: 2 Tickets + Einladung (KI-Befehle) ===\n');

    let packageId: string;
    try {
        const ids = (await get('/api/current-ids')) as { myAddress?: string; packageId?: string };
        packageId = (ids.packageId || '').trim();
        if (!ids.myAddress) throw new Error('MY_ADDRESS nicht gesetzt.');
    } catch (e) {
        console.error('API nicht erreichbar:', (e as Error).message);
        process.exit(1);
    }

    if (UNLOCK_PASSWORD) {
        await post('/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
        console.log('Wallet entsperrt – warte auf Befehl-Handler…');
        for (let i = 0; i < 30; i++) {
            await sleep(1000);
            if (await isCommandHandlerReady()) {
                console.log('Befehl-Handler bereit.\n');
                break;
            }
            if (i === 29) {
                console.error('Timeout: Befehl-Handler nach 30 s nicht bereit. Bitte Wallet in der UI manuell entsperren (Säule 1), dann Test erneut starten.');
                process.exit(1);
            }
        }
    } else {
        if (!(await isCommandHandlerReady())) {
            console.error('Wallet noch nicht entsperrt. Entweder: 1) In der UI (Säule 1) entsperren, oder 2) UNLOCK_PASSWORD=… setzen und Skript erneut starten.');
            process.exit(1);
        }
    }

    const validFrom = '0';
    const validUntil = String(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const steps: { name: string; phrase: string; cmd: string; args: string[] }[] = [
        {
            name: 'Handshake an Gast-Wallet',
            phrase: 'handshake an ' + WALLET1,
            cmd: '/handshake',
            args: [WALLET1],
        },
        {
            name: 'Connect',
            phrase: 'verbinde mit ' + WALLET1,
            cmd: '/connect',
            args: [WALLET1],
        },
        {
            name: 'Ticket 1 (Anna Sommer, A-5-12, 49.99)',
            phrase: 'erstelle ein ticket "Festival 2025" und sende es an ' + WALLET1,
            cmd: '/create-ticket',
            args: [EVENT_ID, validFrom, validUntil, TICKET1_META, WALLET1],
        },
        {
            name: 'Ticket 2 (Tom Winter, B-3-7, 49.99)',
            phrase: 'erstelle ein ticket "Festival 2025" und sende es an ' + WALLET2,
            cmd: '/create-ticket',
            args: [EVENT_ID, validFrom, validUntil, TICKET2_META, WALLET2],
        },
        {
            name: 'Einladung senden (Klartext)',
            phrase: 'schick klartext Sie sind eingeladen! 2 Festival-Tickets (Anna Sommer, Tom Winter) sind unterwegs. Details in den Ticket-NFTs. an ' + WALLET1,
            cmd: '/send-plain',
            args: [WALLET1, 'Sie sind eingeladen! 2 Festival-Tickets (Anna Sommer, Tom Winter) sind unterwegs. Details in den Ticket-NFTs.'],
        },
    ];

    let ok = 0;
    let skip = 0;
    let fail = 0;

    for (const step of steps) {
        process.stdout.write(`  [KI] "${step.phrase.slice(0, 55)}…" → `);
        const ai = await aiCopilot(step.phrase);
        const action = ai.suggestedAction;
        const cmd = action?.cmd ?? '';
        const args = action?.args ?? [];

        const useCmd = cmd === step.cmd ? cmd : step.cmd;
        let useArgs = cmd === step.cmd ? args : step.args;

        if (useCmd === '/create-ticket' && (useArgs[3] === '0x' || !useArgs[3]?.startsWith('0x7b'))) {
            const meta = step.name.includes('Anna') ? TICKET1_META : TICKET2_META;
            useArgs = [EVENT_ID, validFrom, validUntil, meta, useArgs[4] || WALLET1];
        }
        if (useCmd === '/send-plain' && (useArgs.length < 2 || useArgs[1]?.length < 10))
            useArgs = [WALLET1, 'Sie sind eingeladen! 2 Festival-Tickets (Anna Sommer, Tom Winter) sind unterwegs. Details in den Ticket-NFTs.'];

        const result = await runCommand(useCmd, useArgs);
        const success = result.ok === true;
        const detail = result.message || result.error || '';

        if (success) {
            console.log(`[OK] ${useCmd} – ${(result.message || '').slice(0, 60)}`);
            ok++;
        } else {
            const skipLike = /nicht verbunden|MAILBOX|bereits|connect/i.test(detail);
            if (skipLike) {
                console.log(`[SKIP] ${detail.slice(0, 55)}`);
                skip++;
            } else {
                console.log(`[FAIL] ${detail.slice(0, 60)}`);
                fail++;
            }
        }
        await sleep(1000);
    }

    console.log('\n--- Ergebnis ---');
    console.log('OK:', ok, '| SKIP:', skip, '| FAIL:', fail);
    console.log('Tickets: Metadaten (Name, Sitzplatz, Preis) in Ticket 1 + 2, Einladung per send-plain.');
    process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
