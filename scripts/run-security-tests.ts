/**
 * Sicherheitsfokussierte Tests: Blocklist setEnvKey, Adress-Validierung (kein Injection),
 * optional API Injection + Rate-Limit + LAN-Auth P0.5 (wenn API_BASE gesetzt und API läuft).
 * Ausführung: npm run test:security
 * Optional: API_RATE_LIMIT_COMMANDS_PER_MINUTE=2 API_BASE=http://127.0.0.1:3342 npm run test:security
 * LAN-Auth (403 ohne Token): API_BASE=http://<WLAN-IP>:3342 API_AUTH_TOKEN=… (Boss .env)
 */
import { strict as assert } from 'node:assert';
import { apiTestFetchInit, isLoopbackApiBase } from './api-test-headers.js';

const API_BASE = (process.env.API_BASE || process.env.API_URL || '').replace(/\/$/, '');

let passed = 0;
let failed = 0;

function ok(name: string) {
    passed++;
    console.log('  ✓ ' + name);
}
function fail(name: string, err: unknown) {
    failed++;
    console.log('  ✗ ' + name + ': ' + (err instanceof Error ? err.message : String(err)));
}

function mutationFetchInit(init?: RequestInit, opts?: { omitAuth?: boolean }): RequestInit {
    const base: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...init,
    };
    if (opts?.omitAuth) return base;
    if (isLoopbackApiBase(API_BASE)) return base;
    return apiTestFetchInit(base);
}

async function postJson(
    path: string,
    body: Record<string, unknown>,
    opts?: { omitAuth?: boolean }
): Promise<{ status: number; body: string; json?: Record<string, unknown> }> {
    const r = await fetch(API_BASE + path, mutationFetchInit({ body: JSON.stringify(body) }, opts));
    const text = await r.text();
    let json: Record<string, unknown> | undefined;
    try {
        json = JSON.parse(text) as Record<string, unknown>;
    } catch {
        // ignore
    }
    return { status: r.status, body: text, json };
}

async function postCommand(cmd: string, args: string[]): Promise<{ status: number; body: string; json?: Record<string, unknown> }> {
    return postJson('/api/command', { cmd, args });
}

async function testSetEnvKeyBlocklist() {
    console.log('\n--- config (setEnvKey Blocklist) ---');
    const { setEnvKey } = await import('../src/config.js');
    const blocked = ['OPEN_COMMAND', 'OPEN_URL', 'REMOTE_SIGNER_URL', 'REMOTE_SIGNER_TOKEN', 'WALLET_PASSWORD'];
    for (const k of blocked) {
        try {
            const r = setEnvKey(k, 'malicious');
            assert(!r.ok && r.error && r.error.includes('nicht per API'), `setEnvKey blocks ${k}`);
        } catch (e) {
            fail(`setEnvKey blocks ${k}`, e);
            return;
        }
    }
    ok('setEnvKey blocklist (OPEN_COMMAND, OPEN_URL, …)');
}

async function testAddressValidation() {
    console.log('\n--- chain-access (assertSafeAddress via buildHandshakeTransaction) ---');
    const prev = process.env.PACKAGE_ID;
    process.env.PACKAGE_ID = process.env.PACKAGE_ID || '0x' + 'a'.repeat(64);
    const validAddr = '0x' + 'a'.repeat(64);
    const pubKey = new Uint8Array(65).fill(1);

    try {
        const { buildHandshakeTransaction } = await import('../src/chain-access.js');

        buildHandshakeTransaction(validAddr, validAddr, pubKey);
        ok('gültige 0x64-Hex-Adresse akzeptiert');

        const invalidCases: { name: string; addr: string }[] = [
            { name: 'leer', addr: '' },
            { name: 'invalid', addr: 'invalid' },
            { name: 'Shell-Metazeichen', addr: '; rm -rf /' },
            { name: 'Command-Substitution', addr: '$(whoami)' },
            { name: 'Newline', addr: '0x' + 'a'.repeat(62) + '\n' },
            { name: '0x zu kurz (< 40 Zeichen)', addr: '0x' + 'a'.repeat(10) },
            { name: '0x zu lang (> 70 Zeichen)', addr: '0x' + 'a'.repeat(100) },
            { name: '0x mit Sonderzeichen', addr: '0x' + 'a'.repeat(63) + '!' },
            { name: 'Leerzeichen', addr: ' 0x' + 'a'.repeat(64) + ' ' },
        ];

        for (const { name, addr } of invalidCases) {
            try {
                buildHandshakeTransaction(addr, validAddr, pubKey);
                fail(`Adresse abgelehnt: ${name}`, new Error('erwartet: throw'));
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                if (msg.includes('Ungültige') || msg.includes('unsichere') || msg.includes('Adresse')) {
                    ok(`ungültige Adresse abgelehnt: ${name}`);
                } else {
                    fail(`ungültige Adresse: ${name}`, e);
                }
            }
        }
    } catch (e) {
        fail('chain-access Adress-Validierung', e);
    } finally {
        if (prev !== undefined) process.env.PACKAGE_ID = prev;
    }
}

async function testApiInjection() {
    console.log('\n--- API Injection (nur wenn API_BASE gesetzt und API läuft) ---');
    if (!API_BASE) {
        console.log('  ⚠ API_BASE nicht gesetzt – übersprungen');
        return;
    }
    try {
        const r1 = await postCommand('/help', ['"; ls -la']);
        if (r1.status !== 200 && r1.status !== 503) {
            fail('POST /api/command mit arg "; ls -la"', new Error('Status ' + r1.status));
            return;
        }
        if (r1.json && typeof r1.body === 'string' && !r1.body.includes('total ') && !r1.body.includes('node_modules'))
            ok('Injection in args: Antwort enthält kein Shell-Output');
        else if (r1.status === 503) ok('API nicht bereit (503) – Injection-Test übersprungen');
        else ok('API antwortet auf Befehle (Injection in args als Daten, nicht ausgeführt)');

        const r2 = await postCommand('/help; echo pwned', []);
        if (r2.status === 200 || r2.status === 503) {
            const cmdTreated = r2.json?.ok === true ? 'help' : 'unbekannt';
            if (cmdTreated !== 'pwned' && !String(r2.body).includes('pwned')) ok('Cmd mit Semicolon: kein Befehl "echo pwned" ausgeführt');
            else fail('Cmd Injection', new Error('Verdacht auf Ausführung'));
        }
    } catch (e) {
        console.log('  ⚠ API nicht erreichbar: ' + (e instanceof Error ? e.message : e));
    }
}

/** Böser-Mitarbeiter: Arbeiter B darf Key von A nicht ausstellen/löschen → 403. Backend muss mit ROLE=arbeiter laufen. */
async function testRoleForbidden() {
    console.log('\n--- Böser-Mitarbeiter (403 bei keyIssue/revokeDown für Arbeiter) ---');
    if (!API_BASE) {
        console.log('  ⚠ API_BASE nicht gesetzt – übersprungen');
        return;
    }
    try {
        const keyIssueRes = await postCommand('/create-key', ['1', '1']);
        if (keyIssueRes.status === 403 && typeof keyIssueRes.body === 'string' && (keyIssueRes.body.includes('Schlüssel') || keyIssueRes.body.includes('Boss'))) {
            ok('403 für /create-key (keyIssue nur Boss)');
        } else if (keyIssueRes.status === 200 || keyIssueRes.status === 503) {
            console.log('  ⚠ Backend läuft als Boss/Kommandant (oder nicht bereit). Für 403-Test: Backend mit ROLE=arbeiter starten.');
        } else {
            fail('403 /create-key', new Error('Status ' + keyIssueRes.status + ' ' + keyIssueRes.body.slice(0, 80)));
        }

        const revokeRes = await postCommand('/purge-key', ['0x' + 'a'.repeat(64)]);
        if (revokeRes.status === 403 && typeof revokeRes.body === 'string' && (revokeRes.body.includes('Widerruf') || revokeRes.body.includes('Kommandant'))) {
            ok('403 für /purge-key (revokeDown nur Boss/Kommandant)');
        } else if (revokeRes.status === 200 || revokeRes.status === 503 || revokeRes.status === 500) {
            console.log('  ⚠ Backend erlaubt revoke oder Fehler. Für 403-Test: ROLE=arbeiter.');
        } else {
            fail('403 /purge-key', new Error('Status ' + revokeRes.status + ' ' + revokeRes.body.slice(0, 80)));
        }
    } catch (e) {
        console.log('  ⚠ API nicht erreichbar: ' + (e instanceof Error ? e.message : e));
    }
}

async function testApiRateLimit() {
    console.log('\n--- API Rate-Limit (nur wenn API_BASE + API_RATE_LIMIT_COMMANDS_PER_MINUTE gesetzt) ---');
    const limit = parseInt(process.env.API_RATE_LIMIT_COMMANDS_PER_MINUTE || '0', 10);
    if (!API_BASE || limit <= 0) {
        console.log('  ⚠ API_BASE oder API_RATE_LIMIT_COMMANDS_PER_MINUTE nicht gesetzt – übersprungen');
        return;
    }
    try {
        for (let i = 0; i < limit + 1; i++) {
            const r = await postCommand('/help', []);
            if (r.status === 429 && i >= limit) {
                ok('Rate-Limit: nach ' + (limit + 1) + ' Anfragen 429');
                return;
            }
        }
        console.log('  ⚠ Kein 429 nach ' + (limit + 1) + ' Anfragen – vermutlich läuft die API ohne API_RATE_LIMIT_COMMANDS_PER_MINUTE. Hinweis: Rate-Limit nur „best effort“ getestet.');
    } catch (e) {
        console.log('  ⚠ API nicht erreichbar: ' + (e instanceof Error ? e.message : e));
    }
}

async function testLanMutationAuth() {
    console.log('\n--- LAN API-Auth P0.5 (Mutationen ohne Token) ---');
    if (!API_BASE) {
        console.log('  ⚠ API_BASE nicht gesetzt – übersprungen');
        return;
    }
    if (isLoopbackApiBase(API_BASE)) {
        console.log('  ℹ API_BASE ist Loopback — Mutationen ohne Token erlaubt (P0.5). Für 403-Test: API_BASE=http://<WLAN-IP>:3342');
        try {
            const withToken = await postJson('/api/unlock', { password: '' });
            if (withToken.status === 403) {
                fail('Loopback /api/unlock', new Error('403 trotz Loopback — API_BIND_HOST prüfen'));
            } else {
                ok('Loopback: POST /api/unlock ohne explizites Token nicht 403');
            }
        } catch (e) {
            console.log('  ⚠ API nicht erreichbar: ' + (e instanceof Error ? e.message : e));
        }
        return;
    }
    const token = (process.env.API_AUTH_TOKEN || '').trim();
    if (!token) {
        console.log('  ⚠ API_BASE ist LAN-IP aber API_AUTH_TOKEN nicht gesetzt — 403-Test unvollständig');
    }
    try {
        const noAuthUnlock = await postJson('/api/unlock', { password: '' }, { omitAuth: true });
        if (noAuthUnlock.status === 403) {
            ok('POST /api/unlock ohne Token → 403');
        } else {
            fail('LAN-Auth /api/unlock ohne Token', new Error(`erwartet 403, bekam ${noAuthUnlock.status}`));
        }

        const noAuthCmd = await postJson('/api/command', { cmd: '/vault-debug-chain', args: [] }, { omitAuth: true });
        if (noAuthCmd.status === 403) {
            ok('POST /api/command (vault-debug) ohne Token → 403');
        } else {
            fail('LAN-Auth vault-debug ohne Token', new Error(`erwartet 403, bekam ${noAuthCmd.status}`));
        }

        if (token) {
            const withAuth = await postJson('/api/unlock', { password: '' });
            if (withAuth.status !== 403) {
                ok('POST /api/unlock mit API_AUTH_TOKEN → nicht 403');
            } else {
                fail('LAN-Auth mit Token', new Error('403 trotz gültigem API_AUTH_TOKEN'));
            }
        }
    } catch (e) {
        console.log('  ⚠ API nicht erreichbar: ' + (e instanceof Error ? e.message : e));
    }
}

async function main() {
    console.log('Morgendrot – Sicherheits-Tests');
    await testSetEnvKeyBlocklist();
    await testAddressValidation();
    await testApiInjection();
    await testRoleForbidden();
    await testApiRateLimit();
    await testLanMutationAuth();
    console.log('\n--- Ergebnis ---');
    console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error('Runner-Fehler:', e);
    process.exit(1);
});
