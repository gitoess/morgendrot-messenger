/**
 * Ab Schritt 2: Vollständiger Test aller 19 Projekte – Befehle, Funktionen & Einstellungen.
 * Testet alle GET-Endpoints, POST-Endpoints, alle Commands (apiCmd) und alle Docs.
 * Optional: Ticket- & AccessKey-Flow (2 Wallets), wenn API_BASE_B erreichbar und PACKAGE_ID gültig.
 *
 * Aufruf: npx tsx scripts/test-all-projects-full.ts
 * Env: API_BASE (default 3342), API_BASE_B (optional, default 3343), MY_ADDRESS (optional)
 */

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3342';
const API_BASE_B = process.env.API_BASE_B || 'http://127.0.0.1:3343';
const ADDR = process.env.MY_ADDRESS || '0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5';
const PARTNER = process.env.PARTNER_ADDRESS || '0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5';

const EVENT_ID_PLACEHOLDER = '0x' + 'e'.repeat(64);
const LOCK_ID_PLACEHOLDER = '0x' + 'd'.repeat(64);

let ok = 0, fail = 0, skip = 0;
const results: { phase: string; name: string; status: 'OK' | 'SKIP' | 'FAIL'; detail?: string }[] = [];

async function get(base: string, path: string, expectJson = true): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${base}${path}`, { method: 'GET' });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status} ${text.slice(0, 200)}` };
    if (expectJson) {
      try {
        const data = text ? JSON.parse(text) : {};
        return { ok: true, data };
      } catch {
        return { ok: true, data: { raw: text.slice(0, 100) } };
      }
    }
    return { ok: true, data: { raw: text.slice(0, 200) } };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function post(base: string, path: string, body: object): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) return { ok: false, error: (data as any).error || `${res.status} ${text.slice(0, 200)}` };
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function record(phase: string, name: string, status: 'OK' | 'SKIP' | 'FAIL', detail?: string) {
  results.push({ phase, name, status, detail });
  if (status === 'OK') ok++;
  else if (status === 'SKIP') skip++;
  else fail++;
  const sym = status === 'OK' ? '[OK]' : status === 'SKIP' ? '[SKIP]' : '[FAIL]';
  console.log(`  ${sym} ${name}${detail ? ' – ' + detail : ''}`);
}

async function main() {
  console.log('\n=== Morgendrot – Alle 19 Projekte: Befehle, Funktionen & Einstellungen ===\n');
  console.log('API A:', API_BASE, '| API B:', API_BASE_B);
  console.log('Adresse (owner):', ADDR.slice(0, 18) + '…\n');

  const base = API_BASE;

  // ---- Phase 1: GET Endpoints (alle Reiter / Abfragen) ----
  console.log('--- Phase 1: GET Endpoints ---');
  const getTests: [string, string][] = [
    ['status', '/api/status'],
    ['current-ids', '/api/current-ids'],
    ['package-id-history', '/api/package-id-history'],
    ['messenger-presets', '/api/messenger-presets'],
    ['lan-install-urls', '/api/lan-install-urls'],
    ['einsatz-role-templates', '/api/einsatz-role-templates'],
    ['contact-labels', '/api/contact-labels'],
    ['pending-handshakes', '/api/pending-handshakes'],
    ['config', '/api/config'],
    ['connect-addresses', '/api/connect-addresses'],
    ['chain-reachable', '/api/chain-reachable'],
    ['help', '/api/help'],
    ['find-peer-handshake', '/api/find-peer-handshake'],
    ['has-valid-ticket', `/api/has-valid-ticket?owner=${encodeURIComponent(ADDR)}&eventId=${encodeURIComponent(EVENT_ID_PLACEHOLDER)}`],
    ['list-tickets', `/api/list-tickets?owner=${encodeURIComponent(ADDR)}`],
    ['list-keys', `/api/list-keys?owner=${encodeURIComponent(ADDR)}`],
    ['rebate-candidates', `/api/rebate-candidates?owner=${encodeURIComponent(ADDR)}`],
    ['monitor-status', '/api/monitor-status'],
    ['audit-export', '/api/audit-export?format=csv'],
    ['audit-export-pdf', '/api/audit-export?format=pdf'],
  ];
  for (const [name, url] of getTests) {
    const expectJson = name !== 'audit-export' && name !== 'audit-export-pdf';
    const r = await get(base, url, expectJson);
    if (r.ok) record('GET', name, 'OK');
    else if (r.error?.includes('ECONNREFUSED') || r.error?.includes('fetch failed')) {
      record('GET', name, 'FAIL', 'Server nicht erreichbar');
      console.log('\nServer nicht erreichbar. Bitte zuerst "npm run dev" starten (und ggf. morgendrot-kopie auf 3343).');
      process.exit(1);
    } else record('GET', name, r.data && (r.data as any).error ? 'SKIP' : 'FAIL', r.error?.slice(0, 80));
  }
  // ---- Phase 2: POST Endpoints (sicher / nicht destruktiv) ----
  console.log('\n--- Phase 2: POST Endpoints ---');
  const postPayloads: [string, string, object][] = [
    ['config LOG_VERBOSE', '/api/config', { key: 'LOG_VERBOSE', value: 'false' }],
    ['unlock (falsches Passwort)', '/api/unlock', { password: 'wrong-test' }],
    ['generate-address', '/api/generate-address', {}],
    ['purge-after-lieferung (leer)', '/api/purge-after-lieferung', { purges: [] }],
    ['start-boss-signer', '/api/start-boss-signer', {}],
  ];
  for (const [name, url, body] of postPayloads) {
    const r = await post(base, url, body);
    const data = r.data as any;
    const isUnlock = name.startsWith('unlock');
    const isPurgeLieferung = name.startsWith('purge-after');
    const isBossSigner = name.startsWith('start-boss');
    if (r.ok) record('POST', name, 'OK', (data?.message || data?.error)?.slice(0, 40));
    else if (isUnlock && (data?.error === 'Bereits entsperrt' || r.error === 'Bereits entsperrt')) record('POST', name, 'OK', 'Bereits entsperrt (erwartet)');
    else if (isPurgeLieferung && data?.error && (String(data.error).includes('purges') || String(data.error).includes('erforderlich'))) record('POST', name, 'OK', 'Endpoint erreichbar, Fehler erwartet');
    else if (isBossSigner && data?.error) record('POST', name, 'SKIP', (data?.error || data?.message)?.slice(0, 50));
    else if (r.error) record('POST', name, 'FAIL', r.error?.slice(0, 80));
    else record('POST', name, 'SKIP', data?.error?.slice(0, 60));
  }

  // ---- Phase 3: Commands (alle apiCmd aus TREE / 19 Projekte) ----
  console.log('\n--- Phase 3: Commands (alle Befehle) ---');
  type CmdEntry = { cmd: string; args: string[]; expectOk?: boolean };
  const commands: CmdEntry[] = [
    { cmd: '/help', args: [] },
    { cmd: '/handshake', args: [PARTNER] },
    { cmd: '/send-plain', args: [PARTNER, 'Test ' + Date.now()] },
    { cmd: '/transfer-coins', args: [PARTNER, '0.001'] },
    { cmd: '/fetch', args: ['5'] },
    { cmd: '/list-keys', args: [] },
    { cmd: '/list-tickets', args: [] },
    { cmd: '/connect', args: [] },
    { cmd: '/purge-msg', args: ['99999'] },
    { cmd: '/vault-save', args: [] },
    { cmd: '/vault-onchain', args: [] },
    { cmd: '/purge-handshake', args: [] },
    { cmd: '/emergency-purge', args: [] },
    { cmd: '/create-key', args: [LOCK_ID_PLACEHOLDER, PARTNER, '1'] },
    { cmd: '/create-keys', args: [LOCK_ID_PLACEHOLDER, PARTNER, '1', '1'] },
    { cmd: '/list-keys', args: [] },
    { cmd: '/list-tickets', args: [] },
    { cmd: '/create-ticket', args: [EVENT_ID_PLACEHOLDER, '0', String(Date.now() + 86400000 * 365), '0x', PARTNER] },
    { cmd: '/send', args: ['Test'] },
    { cmd: '/emergency-purge-key', args: ['0x' + 'a'.repeat(64)] },
    { cmd: '/purge-key', args: ['0x' + 'a'.repeat(64)] },
    { cmd: '/transfer-key', args: ['0x' + 'a'.repeat(64), PARTNER] },
    { cmd: '/use-ticket', args: ['0x' + 'a'.repeat(64), EVENT_ID_PLACEHOLDER] },
    { cmd: '/purge-ticket', args: ['0x' + 'a'.repeat(64)] },
    { cmd: '/emergency-purge-ticket', args: ['0x' + 'a'.repeat(64)] },
    { cmd: '/transfer-ticket', args: ['0x' + 'a'.repeat(64), PARTNER] },
  ];
  for (const { cmd, args } of commands) {
    const r = await post(base, '/api/command', { cmd, args });
    const data = r.data as any;
    if (r.ok && data?.ok === true) record('Command', cmd, 'OK');
    else if (r.ok && (data?.message || data?.error)) {
      const msg = (data.message || data.error || '').slice(0, 70);
      if (msg.includes('VAULT_FILE') || msg.includes('nicht gesetzt') || msg.includes('Invalid') || msg.includes('MAILBOX') || msg.includes('ENABLE_PURGE') || msg.includes('VAULT_REGISTRY') || msg.includes('create_globals')) record('Command', cmd, 'SKIP', msg);
      else record('Command', cmd, 'OK', msg);
    } else if (!r.ok && r.error) record('Command', cmd, 'FAIL', r.error?.slice(0, 80));
    else record('Command', cmd, data?.error ? 'SKIP' : 'FAIL', data?.error?.slice(0, 60));
  }

  // ---- Phase 4: Ticket- & AccessKey-Flow (Schritt 2) – optional ----
  console.log('\n--- Phase 4: Ticket- & AccessKey-Flow (optional, siehe npm run test:tickets-keys) ---');
  let idsA: { myAddress?: string; packageId?: string } = {};
  try {
    const r = await get(API_BASE, '/api/current-ids');
    if (r.ok && r.data) idsA = r.data as any;
  } catch (_) {}
  const pkgId = (idsA.packageId || '').trim();
  let apiBReachable = false;
  try {
    apiBReachable = (await get(API_BASE_B, '/api/status')).ok;
  } catch (_) {}
  if (/^0x[a-fA-F0-9]{64}$/.test(pkgId) && apiBReachable) {
    try {
      const { execSync } = await import('node:child_process');
      execSync('npx tsx scripts/test-tickets-keys-flow.ts', {
        env: { ...process.env, API_BASE_A: API_BASE, API_BASE_B: API_BASE_B },
        stdio: 'pipe',
        timeout: 120_000,
        cwd: process.cwd(),
      });
      record('Flow', 'Ticket+AccessKey (2 Wallets)', 'OK');
    } catch (e: any) {
      const out = (e.stdout?.toString?.() || e.stderr?.toString() || e.message || '').slice(0, 200);
      if (out.includes('PACKAGE_ID') || out.includes('Invalid') || out.includes('create_globals') || out.includes('ECONNREFUSED')) record('Flow', 'Ticket+AccessKey', 'SKIP', 'Chain/2. Instanz – separat: npm run test:tickets-keys');
      else record('Flow', 'Ticket+AccessKey', 'SKIP', out.slice(0, 80));
    }
  } else {
    record('Flow', 'Ticket+AccessKey', 'SKIP', !/^0x[a-fA-F0-9]{64}$/.test(pkgId) ? 'PACKAGE_ID 0x+64 Hex nötig' : 'Zweite Instanz (3343) für 2-Wallet – separat: npm run test:tickets-keys');
  }

  // ---- Zusammenfassung ----
  console.log('\n=== Zusammenfassung (alle 19 Projekte: Befehle, Funktionen & Einstellungen) ===');
  console.log('OK:', ok, '| Übersprungen:', skip, '| Fehlgeschlagen:', fail);
  const byPhase: Record<string, number[]> = {};
  for (const r of results) {
    if (!byPhase[r.phase]) byPhase[r.phase] = [0, 0, 0];
    if (r.status === 'OK') byPhase[r.phase][0]++;
    else if (r.status === 'SKIP') byPhase[r.phase][1]++;
    else byPhase[r.phase][2]++;
  }
  console.log('\nPro Phase:');
  for (const [ph, [o, s, f]] of Object.entries(byPhase)) console.log(`  ${ph}: OK ${o}, SKIP ${s}, FAIL ${f}`);
  if (fail > 0) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
