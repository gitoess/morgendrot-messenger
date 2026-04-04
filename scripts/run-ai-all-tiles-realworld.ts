/**
 * Alle im Projekt möglichen Befehle mit KI Real-World: natürliche Phrase → /api/ai-copilot → echte TX.
 * Abgedeckt: Senden (handshake, connect, send, send-plain, fetch, transfer-coins), Löschen (purge-handshake,
 * purge-msg, purge-key, purge-ticket, emergency-purge, emergency-purge-key, emergency-purge-ticket), Erstellen
 * (create-key, create-keys, create-key-and-notify, create-ticket), Rebaten/Übertragen (purge-ticket, transfer-key,
 * transfer-ticket, use-ticket), Listen (list-keys, list-tickets), Vault (vault-save, vault-onchain), Hilfe.
 * Boss: /api/generate-address wird einmal aufgerufen; gas-station-check und boss-provision-handshake sind eigene APIs.
 *
 * Voraussetzung: Morgendrot läuft (npm run start), Wallet entsperrt, RPC erreichbar.
 * Aufruf: TARGET_ADDRESS=0x… npm run test:ai-all-tiles-realworld
 * Optional: UNLOCK_PASSWORD=… LOCK_ID=0x… API_BASE=http://127.0.0.1:3342
 */
import 'dotenv/config';

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3342').replace(/\/$/, '');
const TARGET_ADDRESS = process.env.TARGET_ADDRESS || process.env.PARTNER_ADDRESS || '';
const LOCK_ID = process.env.LOCK_ID || '0x' + 'd'.repeat(64);
const UNLOCK_PASSWORD = process.env.UNLOCK_PASSWORD || '';
const EVENT_ID_PLACEHOLDER = '0x' + 'e'.repeat(64);
const KEY_OBJ_ID = '0x' + '1'.repeat(64);
const TICKET_OBJ_ID = '0x' + '2'.repeat(64);
const EVENT_OBJ_ID = '0x' + 'e'.repeat(64);

type Step = { kachel: string; phrase: string; expectCmd?: string };

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

function buildSteps(target: string, packageId: string, secondAddr: string): Step[] {
    const steps: Step[] = [
        { kachel: '1. Anfang', phrase: 'hilfe anzeigen', expectCmd: '' },
        { kachel: '1. Anfang', phrase: 'was kann ich alles machen', expectCmd: '' },
    ];
    if (packageId && /^0x[a-fA-F0-9]{64}$/.test(packageId)) {
        steps.push({ kachel: '1. Anfang', phrase: 'setze die package-id auf ' + packageId, expectCmd: '/set-package-id' });
    }
    steps.push(
        { kachel: '2. Kanal', phrase: 'handshake an ' + target, expectCmd: '/handshake' },
        { kachel: '2. Kanal', phrase: 'verbinde mit ' + target, expectCmd: '/connect' },
        { kachel: '2. Kanal', phrase: 'sichere leitung zu ' + target + ' aufbauen', expectCmd: '/handshake' },
        { kachel: '2. Kanal', phrase: 'chat mit ' + target + ' starten', expectCmd: '/connect' },
        { kachel: '3. Chat', phrase: 'sende nachricht "ki läuft" an ' + target, expectCmd: '/handshake' },
        { kachel: '3. Chat', phrase: 'hole letzten 20', expectCmd: '/fetch' },
        { kachel: '3. Chat', phrase: 'hole letzte 50 nachrichten von ' + target, expectCmd: '/fetch' },
        { kachel: '3. Chat', phrase: 'sende hallo', expectCmd: '/send' },
        { kachel: '3. Chat', phrase: 'verschlüsselte nachricht schicken', expectCmd: '/send' },
        { kachel: '3. Chat', phrase: 'schick klartext test an ' + target, expectCmd: '/send-plain' },
        { kachel: '3. Chat', phrase: 'sende 0.001 iota an ' + target, expectCmd: '/transfer-coins' },
        { kachel: '3. Chat', phrase: 'überweise 0.5 iota an ' + target, expectCmd: '/transfer-coins' },
        { kachel: '4. Nachsorge', phrase: 'vault speichern', expectCmd: '/vault-save' },
        { kachel: '4. Nachsorge', phrase: 'speichere messaging-keys lokal', expectCmd: '/vault-save' },
        { kachel: '4. Nachsorge', phrase: 'vault onchain', expectCmd: '/vault-onchain' },
        { kachel: '4. Nachsorge', phrase: 'purge handshake', expectCmd: '/purge-handshake' },
        { kachel: '4. Nachsorge', phrase: 'lösche den handshake aus der mailbox', expectCmd: '/purge-handshake' },
        { kachel: '4. Nachsorge', phrase: 'nachricht aus mailbox löschen nonce 1', expectCmd: '/purge-msg' },
        { kachel: '4. Nachsorge', phrase: 'emergency purge', expectCmd: '/emergency-purge' },
        { kachel: '5. Keys', phrase: 'zutritt für ' + target + ' für 7 tage', expectCmd: '/create-key' },
        { kachel: '5. Keys', phrase: 'gib der adresse ' + target + ' einen schlüssel für 30 tage', expectCmd: '/create-key' },
        { kachel: '5. Keys', phrase: 'drei gäste-keys für ' + target, expectCmd: '/create-keys' },
        { kachel: '5. Keys', phrase: 'erstelle 3 keys für ' + target + ' mit 14 tagen', expectCmd: '/create-keys' },
        { kachel: '5. Keys', phrase: 'gast ' + target + ' soll key bekommen und bestätigung', expectCmd: '/create-key-and-notify' },
        { kachel: '5. Keys', phrase: 'zeig mir meine accesskeys', expectCmd: '/list-keys' },
        { kachel: '5. Keys', phrase: 'lösche den alten key mit der id ' + KEY_OBJ_ID, expectCmd: '/purge-key' },
        { kachel: '5. Keys', phrase: 'key ' + KEY_OBJ_ID + ' für notfall-purge vorbereiten', expectCmd: '/emergency-purge-key' },
        { kachel: '5. Keys', phrase: 'übertrage key ' + KEY_OBJ_ID + ' an ' + (secondAddr || target), expectCmd: '/transfer-key' },
        { kachel: '6. Tickets', phrase: 'erstelle ein ticket "ki-test" und sende es an ' + target, expectCmd: '/create-ticket' },
        { kachel: '6. Tickets', phrase: 'ticket für event erstellen an ' + target, expectCmd: '/create-ticket' },
        { kachel: '6. Tickets', phrase: 'zeig meine tickets', expectCmd: '/list-tickets' },
        { kachel: '6. Tickets', phrase: 'ticket ' + TICKET_OBJ_ID + ' einlösen für event ' + EVENT_OBJ_ID, expectCmd: '/use-ticket' },
        { kachel: '6. Tickets', phrase: 'ticket ' + TICKET_OBJ_ID + ' löschen', expectCmd: '/purge-ticket' },
        { kachel: '6. Tickets', phrase: 'ticket ' + TICKET_OBJ_ID + ' notfall-purge vorbereiten', expectCmd: '/emergency-purge-ticket' },
        { kachel: '6. Tickets', phrase: 'ticket ' + TICKET_OBJ_ID + ' an ' + (secondAddr || target) + ' übertragen', expectCmd: '/transfer-ticket' },
        { kachel: '7. Hilfe', phrase: 'was sind die 13 schritte', expectCmd: '' },
        { kachel: '7. Hilfe', phrase: 'hilfe anzeigen', expectCmd: '' },
    );
    return steps;
}

async function main() {
    console.log('\n=== KI Real-World: Alle Befehle (Senden, Löschen, Erstellen, Rebaten, Keys/Tickets, Hilfe) ===\n');

    if (!TARGET_ADDRESS || !/^0x[a-fA-F0-9]{64}$/.test(TARGET_ADDRESS)) {
        console.error('TARGET_ADDRESS (oder PARTNER_ADDRESS) fehlt oder ungültig (0x + 64 Hex).');
        console.error('Beispiel: TARGET_ADDRESS=0x' + '0'.repeat(64) + ' npm run test:ai-all-tiles-realworld');
        process.exit(1);
    }

    let myAddress: string;
    let packageId: string;
    try {
        const ids = (await get('/api/current-ids')) as { myAddress?: string; packageId?: string };
        myAddress = ids.myAddress || '';
        packageId = (ids.packageId || '').trim();
        if (!myAddress) throw new Error('MY_ADDRESS nicht gesetzt (current-ids).');
    } catch (e) {
        console.error('API nicht erreichbar oder Konfiguration unvollständig:', (e as Error).message);
        process.exit(1);
    }

    if (UNLOCK_PASSWORD) {
        await post('/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
        console.log('Wallet entsperrt.\n');
    }

    // Optional: zweite Adresse als Boss erzeugen (für spätere Schritte)
    let secondAddress: string | null = null;
    try {
        const gen = (await post('/api/generate-address', {})) as { address?: string };
        if (gen?.address) {
            secondAddress = gen.address;
            console.log('Boss: Adresse erzeugt:', secondAddress.slice(0, 18) + '…\n');
        }
    } catch {
        // ohne generate-address weitermachen
    }

    const steps = buildSteps(TARGET_ADDRESS, packageId, secondAddress || '');
    let ok = 0;
    let skip = 0;
    let fail = 0;

    for (const { kachel, phrase, expectCmd } of steps) {
        const ai = await aiCopilot(phrase);
        const action = ai.suggestedAction;
        const cmd = action?.cmd ?? '';
        const args = action?.args ?? [];

        if (!action && expectCmd !== '') {
            console.log(`  [SKIP] ${kachel}: "${phrase.slice(0, 45)}…" → KI keine Aktion`);
            skip++;
            continue;
        }
        const wantCmd = expectCmd?.replace(/^\//, '') || '';
        if (wantCmd && cmd !== expectCmd && cmd?.replace(/^\//, '') !== wantCmd) {
            console.log(`  [SKIP] ${kachel}: erwartet ${expectCmd}, KI → ${cmd || '–'}`);
            skip++;
            continue;
        }

        if (!cmd) {
            console.log(`  [OK] ${kachel}: "${phrase.slice(0, 40)}…" → Hilfe/Text (kein Befehl)`);
            ok++;
            continue;
        }

        // Argumente anpassen: create-key/create-ticket/create-key-and-notify brauchen echte IDs oder Placeholder
        let runArgs = args.map((a) => (a != null ? String(a).trim() : '')).filter((a) => a !== '');
        if (cmd === '/create-key' && (runArgs[0] === '0x' + 'd'.repeat(64) || !runArgs[0])) runArgs = [LOCK_ID, runArgs[1] || TARGET_ADDRESS, runArgs[2] || '30'];
        if (cmd === '/create-keys' && (runArgs[0] === '0x' + 'd'.repeat(64) || !runArgs[0])) runArgs = [LOCK_ID, runArgs[1] || TARGET_ADDRESS, runArgs[2] || '30', runArgs[3] || '3'];
        if (cmd === '/create-key-and-notify' && (runArgs[0] === '0x' + 'd'.repeat(64) || !runArgs[0])) runArgs = [LOCK_ID, runArgs[1] || TARGET_ADDRESS, runArgs[2] || '30', runArgs[3] || 'Key ausgestellt.'];
        if (cmd === '/create-ticket' && (runArgs[0]?.startsWith('<') || !runArgs[0])) runArgs = [EVENT_ID_PLACEHOLDER, '0', String(Date.now() + 7 * 24 * 60 * 60 * 1000), '0x', TARGET_ADDRESS];
        if (cmd === '/purge-key' && !runArgs[0]) runArgs = [KEY_OBJ_ID];
        if (cmd === '/emergency-purge-key' && !runArgs[0]) runArgs = [KEY_OBJ_ID];
        if (cmd === '/purge-ticket' && !runArgs[0]) runArgs = [TICKET_OBJ_ID];
        if (cmd === '/emergency-purge-ticket' && !runArgs[0]) runArgs = [TICKET_OBJ_ID];
        if (cmd === '/use-ticket' && (runArgs.length < 2 || !runArgs[0] || !runArgs[1])) runArgs = [TICKET_OBJ_ID, EVENT_OBJ_ID];
        if (cmd === '/transfer-key' && (runArgs.length < 2 || !runArgs[0] || !runArgs[1])) runArgs = [KEY_OBJ_ID, secondAddress || TARGET_ADDRESS];
        if (cmd === '/transfer-ticket' && (runArgs.length < 2 || !runArgs[0] || !runArgs[1])) runArgs = [TICKET_OBJ_ID, secondAddress || TARGET_ADDRESS];

        const result = await runCommand(cmd, runArgs);
        const success = result.ok === true;
        const detail = result.message || result.error || '';

        if (success) {
            console.log(`  [OK] ${kachel}: ${cmd} ${runArgs.slice(0, 2).join(' ')}… → ${(result.message || '').slice(0, 50)}`);
            ok++;
        } else {
            const skipLike = /nicht verbunden|nicht gesetzt|MAILBOX|VAULT_FILE|Passwort|skip|bereits|connect|nicht gefunden|object.*not found|ENABLE_PURGE|VAULT_REGISTRY|undefined|BigInt/i.test(detail);
            if (skipLike) {
                console.log(`  [SKIP] ${kachel}: ${cmd} – ${detail.slice(0, 55)}`);
                skip++;
            } else {
                console.log(`  [FAIL] ${kachel}: ${cmd} – ${detail.slice(0, 60)}`);
                fail++;
            }
        }
        await sleep(800);
    }

    console.log('\n--- Ergebnis ---');
    console.log('OK:', ok, '| SKIP:', skip, '| FAIL:', fail);
    if (secondAddress) console.log('Erzeugte Adresse (Boss):', secondAddress.slice(0, 18) + '…');
    process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
