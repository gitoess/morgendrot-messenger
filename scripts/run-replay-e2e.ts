/**
 * E2E-Replay-Hilfe: Sendet zweimal „open“ an die Lock-Adresse (per Sender-API).
 * Jeder Aufruf erzeugt eine neue Nonce → im Lock-Log erscheinen zwei OPEN GRANTED.
 * Echten Replay (gleiche Nonce zweimal) kannst du nur manuell prüfen (siehe TESTING.md).
 *
 * Voraussetzung: Sender-API läuft (Wallet entsperrt), Lock läuft mit REPLAY_STATE_FILE.
 * Env: API_BASE (Sender), LOCK_ADDRESS (Lock MY_ADDRESS, Empfänger für /send-plain).
 *
 * Aufruf: npm run test:replay-e2e
 */
import { apiTestFetchInit } from './api-test-headers.js';

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3342').replace(/\/$/, '');
const LOCK_ADDRESS = process.env.LOCK_ADDRESS || process.env.PARTNER_ADDRESS || '';

async function postCommand(cmd: string, args: string[]): Promise<{ ok?: boolean; error?: string }> {
    const res = await fetch(
        `${API_BASE}/api/command`,
        apiTestFetchInit({
            body: JSON.stringify({ cmd, args }),
        })
    );
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: data?.error || `HTTP ${res.status}` };
    return data;
}

async function main() {
    console.log('E2E Replay – zweimal „open“ an Lock senden\n');
    console.log('API_BASE:', API_BASE, '| LOCK_ADDRESS:', LOCK_ADDRESS ? LOCK_ADDRESS.slice(0, 18) + '…' : '(nicht gesetzt)');

    if (!LOCK_ADDRESS || !LOCK_ADDRESS.startsWith('0x') || LOCK_ADDRESS.length < 64) {
        console.error('\nLOCK_ADDRESS (oder PARTNER_ADDRESS) fehlt oder ungültig. Setze z. B. LOCK_ADDRESS=0x… (64 Hex).');
        process.exit(1);
    }

    const r1 = await postCommand('/send-plain', [LOCK_ADDRESS, 'open']);
    console.log(r1.ok ? '  [OK] 1. open gesendet' : '  [FAIL] 1. open: ' + (r1.error || 'Unbekannt'));

    await new Promise((r) => setTimeout(r, 1500));

    const r2 = await postCommand('/send-plain', [LOCK_ADDRESS, 'open']);
    console.log(r2.ok ? '  [OK] 2. open gesendet' : '  [FAIL] 2. open: ' + (r2.error || 'Unbekannt'));

    console.log('\nIm Lock-Log prüfen: zwei OPEN GRANTED (jeweils neue Nonce). Echter Replay = gleiche Nonce zweimal → nur manuell/testweise prüfbar (siehe TESTING.md).');
    process.exit(r1.ok && r2.ok ? 0 : 1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
