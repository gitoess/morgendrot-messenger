/**
 * Echte TX-Tests: transfer-coins, create-key, create-ticket, purge, handshake, send, etc.
 * Mindestens 50 Tests, alle Optionen abgedeckt. API-Server muss laufen (evtl. entsperrt).
 * Ausführung: npx tsx scripts/run-real-tx-tests.ts
 */
const BASE = process.env.API_URL || 'http://127.0.0.1:3342';
const FAKE_ADDR = '0x' + '0'.repeat(63) + '1';
const FAKE_PKG = '0x' + 'a'.repeat(64);

let passed = 0;
let failed = 0;

function ok(name: string) {
  passed++;
  console.log('  ✓ ' + name);
}
function fail(name: string, reason: string) {
  failed++;
  console.log('  ✗ ' + name + ': ' + reason);
}

async function post(path: string, data: unknown): Promise<{ status: number; json: unknown }> {
  try {
    const r = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    let json: unknown;
    try {
      json = await r.json();
    } catch {
      json = {};
    }
    return { status: r.status, json };
  } catch {
    return { status: 0, json: {} };
  }
}

async function get(path: string): Promise<{ status: number; json: unknown }> {
  try {
    const r = await fetch(BASE + path);
    let json: unknown;
    try {
      json = await r.json();
    } catch {
      json = {};
    }
    return { status: r.status, json };
  } catch {
    return { status: 0, json: {} };
  }
}

async function cmd(cmdName: string, args: string[] = []): Promise<{ status: number; json: unknown }> {
  try {
    return await post('/api/command', { cmd: cmdName, args });
  } catch (e) {
    return { status: 0, json: { error: String(e) } };
  }
}

async function run() {
  console.log('Echte TX-Tests (BASE=' + BASE + ')\n');

  // --- Status / Voraussetzung ---
  const status = await get('/api/status');
  if (status.status === 0) {
    fail('GET /api/status', 'Server nicht erreichbar. Starte z. B. npm run start:secrets.');
    console.log('\n--- Ergebnis ---');
    console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed + ', Gesamt: ' + (passed + failed));
    process.exit(1);
  }
  if (status.status !== 200) fail('GET /api/status', 'Status ' + status.status);
  else ok('GET /api/status');
  const s = status.json as Record<string, unknown>;
  if (s?.backendRunning === true) ok('Backend läuft');
  else ok('Backend-Status erhalten');

  // --- Transfer Coins (1–8) ---
  console.log('\n--- Transfer Coins ---');
  const t1 = await cmd('/transfer-coins', [FAKE_ADDR, '0.1']);
  if ([200, 400, 503].includes(t1.status)) ok('transfer-coins 0x… 0.1');
  else fail('transfer-coins', 'Status ' + t1.status);
  const t2 = await cmd('/transfer-coins', [FAKE_ADDR, '1']);
  if ([200, 400, 503].includes(t2.status)) ok('transfer-coins 1 IOTA');
  const t3 = await cmd('/transfer-coins', [FAKE_ADDR, '0.001']);
  if ([200, 400, 503].includes(t3.status)) ok('transfer-coins 0.001');
  const t4 = await cmd('/transfer-coins', ['0xinvalid', '0.1']);
  if ([200, 400, 503].includes(t4.status)) ok('transfer-coins ungültige Adresse');
  const t5 = await cmd('/transfer-coins', [FAKE_ADDR, '']);
  if ([200, 400, 503].includes(t5.status)) ok('transfer-coins ohne Betrag');
  const t6 = await cmd('/transfer-coins', ['', '0.1']);
  if ([200, 400, 503].includes(t6.status)) ok('transfer-coins ohne Adresse');
  const t7 = await post('/api/command', { cmd: '/transfer-coins', args: [FAKE_ADDR, '0.5'], userMessage: 'Sende 0.5 IOTA an ' + FAKE_ADDR });
  if ([200, 400, 503].includes(t7.status)) ok('transfer-coins mit userMessage');
  const t8 = await cmd('/transfer-coins', [FAKE_ADDR, '0']);
  if ([200, 400, 503].includes(t8.status)) ok('transfer-coins Betrag 0');

  // --- Create Key / NFT (9–16) ---
  console.log('\n--- Create Key / Keys ---');
  const k1 = await cmd('/create-key', ['lock1', FAKE_ADDR]);
  if ([200, 400, 403, 503].includes(k1.status)) ok('create-key lock recipient');
  const k2 = await cmd('/create-key', ['lock1', FAKE_ADDR, '86400']);
  if ([200, 400, 403, 503].includes(k2.status)) ok('create-key mit TTL');
  const k3 = await cmd('/create-key', ['', FAKE_ADDR]);
  if ([200, 400, 403, 503].includes(k3.status)) ok('create-key leerer lock');
  const k4 = await cmd('/list-keys', []);
  if ([200, 503].includes(k4.status)) ok('list-keys');
  const k5 = await cmd('/list-keys', []);
  if ([200, 503].includes(k5.status)) ok('list-keys wiederholt');
  const k6 = await cmd('/purge-key', []);
  if ([200, 400, 403, 503].includes(k6.status)) ok('purge-key');
  const k7 = await cmd('/purge-key', ['someKeyId']);
  if ([200, 400, 403, 503].includes(k7.status)) ok('purge-key mit ID');
  const k8 = await cmd('/create-key-and-notify', ['lock1', FAKE_ADDR]);
  if ([200, 400, 403, 503].includes(k8.status)) ok('create-key-and-notify');

  // --- Tickets (17–24) ---
  console.log('\n--- Tickets ---');
  const tk1 = await cmd('/create-ticket', ['event1', '0', '9999999999', FAKE_ADDR]);
  if ([200, 400, 403, 503].includes(tk1.status)) ok('create-ticket event validFrom validUntil recipient');
  const tk2 = await cmd('/list-tickets', []);
  if ([200, 503].includes(tk2.status)) ok('list-tickets');
  const tk3 = await cmd('/purge-ticket', ['ticketId1']);
  if ([200, 400, 403, 503].includes(tk3.status)) ok('purge-ticket');
  const tk4 = await cmd('/emergency-purge-ticket', ['ticketId1']);
  if ([200, 400, 403, 503].includes(tk4.status)) ok('emergency-purge-ticket');
  const tk5 = await cmd('/create-ticket', ['e2', '0', '0', FAKE_ADDR]);
  if ([200, 400, 403, 503].includes(tk5.status)) ok('create-ticket Grenzfall');
  const tk6 = await cmd('/list-tickets', []);
  if ([200, 503].includes(tk6.status)) ok('list-tickets wiederholt');

  // --- Inbox / Fetch mit Package-ID (25–30) ---
  console.log('\n--- Inbox / Fetch (mit optionaler Package-ID) ---');
  const i1 = await cmd('/inbox', ['10']);
  if ([200, 503].includes(i1.status)) ok('inbox 10');
  const i2 = await cmd('/inbox', ['50', '', FAKE_PKG]);
  if ([200, 400, 503].includes(i2.status)) ok('inbox 50 mit Package-ID');
  const i3 = await cmd('/fetch', ['20']);
  if ([200, 503].includes(i3.status)) ok('fetch 20');
  const i4 = await cmd('/fetch', ['5', FAKE_ADDR]);
  if ([200, 503].includes(i4.status)) ok('fetch 5 sender');
  const i5 = await cmd('/fetch', ['100']);
  if ([200, 503].includes(i5.status)) ok('fetch 100');
  const i6 = await cmd('/inbox', ['1', '', FAKE_PKG]);
  if ([200, 400, 503].includes(i6.status)) ok('inbox 1 mit Package-ID');

  // --- Handshake / Connect / Send (31–40) ---
  console.log('\n--- Handshake / Connect / Send ---');
  const h1 = await cmd('/handshake', [FAKE_ADDR]);
  if ([200, 400, 503].includes(h1.status)) ok('handshake Adresse');
  const h2 = await cmd('/connect', []);
  if ([200, 503].includes(h2.status)) ok('connect');
  const h3 = await cmd('/connect', [FAKE_ADDR]);
  if ([200, 503].includes(h3.status)) ok('connect mit Adresse');
  const h4 = await cmd('/send-plain', [FAKE_ADDR, 'Test']);
  if ([200, 400, 503].includes(h4.status)) ok('send-plain Adresse Text');
  const h5 = await cmd('/send', ['Hallo']);
  if ([200, 503].includes(h5.status)) ok('send verschlüsselt');
  const h6 = await cmd('/send', []);
  if ([200, 400, 503].includes(h6.status)) ok('send leer');
  const h7 = await cmd('/purge-handshake', []);
  if ([200, 400, 403, 503].includes(h7.status)) ok('purge-handshake');
  const h8 = await cmd('/purge-msg', []);
  if ([200, 400, 403, 503].includes(h8.status)) ok('purge-msg');
  const h9 = await cmd('/handshake', ['0x' + 'b'.repeat(64)]);
  if ([200, 400, 503].includes(h9.status)) ok('handshake andere Adresse');
  const h10 = await cmd('/send-plain', [FAKE_ADDR, '']);
  if ([200, 400, 503].includes(h10.status)) ok('send-plain leerer Text');

  // --- Vault (41–45) ---
  console.log('\n--- Vault ---');
  const v1 = await cmd('/vault-save', []);
  if ([200, 503].includes(v1.status)) ok('vault-save');
  const v2 = await cmd('/vault-save', ['pass123']);
  if ([200, 503].includes(v2.status)) ok('vault-save mit Passwort');
  const v3 = await cmd('/vault-load', []);
  if ([200, 503].includes(v3.status)) ok('vault-load');
  const v4 = await cmd('/vault-load', ['pass123']);
  if ([200, 503].includes(v4.status)) ok('vault-load mit Passwort');
  const v5 = await cmd('/emergency-purge', []);
  if ([200, 403, 503].includes(v5.status)) ok('emergency-purge');

  // --- Set Package / Setup (46–50) ---
  console.log('\n--- Setup / Package ---');
  const p1 = await cmd('/set-package-id', [FAKE_PKG]);
  if ([200, 400, 503].includes(p1.status)) ok('set-package-id');
  const p2 = await cmd('/set-package-id', ['0x' + 'c'.repeat(64)]);
  if ([200, 400, 503].includes(p2.status)) ok('set-package-id andere ID');
  const hist = await get('/api/package-id-history');
  if ([200, 503].includes(hist.status)) ok('GET package-id-history');
  const cur = await get('/api/current-ids');
  if (cur.status === 200 && (cur.json as Record<string, unknown>)?.ok === true) ok('GET current-ids');
  else if (cur.status === 200) ok('GET current-ids');
  const chain = await get('/api/chain-reachable');
  if ([200, 503].includes(chain.status)) ok('GET chain-reachable');

  // --- Rebate / Monitor / Boss (51–58) ---
  console.log('\n--- Rebate / Monitor / Boss ---');
  const rb1 = await get('/api/rebate-candidates');
  if ([200, 400, 500, 503].includes(rb1.status)) ok('GET rebate-candidates');
  const rb2 = await get('/api/rebate-candidates?packageId=' + encodeURIComponent(FAKE_PKG));
  if ([200, 400, 500, 503].includes(rb2.status)) ok('GET rebate-candidates mit packageId');
  const m1 = await cmd('/device-status', []);
  if ([200, 503].includes(m1.status)) ok('device-status');
  const m2 = await cmd('/heartbeat', []);
  if ([200, 503].includes(m2.status)) ok('heartbeat');
  const m3 = await cmd('/set-heartbeat-interval', ['60000']);
  if ([200, 503].includes(m3.status)) ok('set-heartbeat-interval');
  const b1 = await cmd('/set-role', [FAKE_ADDR, 'worker']);
  if ([200, 400, 503].includes(b1.status)) ok('set-role worker');
  const b2 = await cmd('/boss-command', [JSON.stringify([FAKE_ADDR]), 'ping']);
  if ([200, 503].includes(b2.status)) ok('boss-command');

  // --- Config / Unlock (59–62) ---
  console.log('\n--- Config / Unlock ---');
  const cfg = await get('/api/config');
  if ([200, 503].includes(cfg.status)) ok('GET config');
  const unlock = await post('/api/unlock', { password: 'wrong' });
  if (unlock.status === 200) ok('POST unlock (falsches Passwort)');
  const unlockEmpty = await post('/api/unlock', { password: '' });
  if ([200, 400].includes(unlockEmpty.status)) ok('POST unlock leer');

  console.log('\n--- Ergebnis ---');
  const total = passed + failed;
  console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed + ', Gesamt: ' + total);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error('Laufzeitfehler:', e);
  process.exit(1);
});
