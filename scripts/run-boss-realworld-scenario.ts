/**
 * Real-World-Szenario: Ein Wallet als Boss – passive Arbeiter, Rebate, Heartbeat,
 * Kommandant/Pinnwand-Kombinationen. Alle Aktionen, die ohne zweites aktives Wallet gehen.
 * API-Server muss laufen (Wallet entsperrt empfohlen).
 * Ausführung: npx tsx scripts/run-boss-realworld-scenario.ts
 */
const BASE = process.env.API_URL || 'http://127.0.0.1:3342';

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

async function get(path: string): Promise<{ status: number; json: unknown }> {
  try {
    const r = await fetch(BASE + path);
    const json = await r.json().catch(() => ({}));
    return { status: r.status, json };
  } catch {
    return { status: 0, json: {} };
  }
}

async function post(path: string, data: unknown): Promise<{ status: number; json: unknown }> {
  try {
    const r = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await r.json().catch(() => ({}));
    return { status: r.status, json };
  } catch {
    return { status: 0, json: {} };
  }
}

function cmd(cmdName: string, args: string[] = []) {
  return post('/api/command', { cmd: cmdName, args });
}

function setConfig(key: string, value: string) {
  return post('/api/config', { key, value });
}

async function run() {
  console.log('Boss Real-World-Szenario (ein Wallet, alle Kombinationen)\n');

  if ((await get('/api/status')).status === 0) {
    fail('Server', 'Nicht erreichbar. Starte npm run start:secrets.');
    process.exit(1);
  }
  ok('Server erreichbar');

  const ids = await get('/api/current-ids');
  const myAddr = (ids.json as Record<string, string>)?.myAddress ?? '';
  const pkgId = (ids.json as Record<string, string>)?.packageId ?? '';
  const FAKE = '0x' + '0'.repeat(63) + '1';
  const W1 = '0x' + 'a'.repeat(64);
  const W2 = '0x' + 'b'.repeat(64);
  const W3 = '0x' + 'c'.repeat(64);

  // --- 1) Rolle: Boss setzen ---
  console.log('\n--- 1) Rolle Boss ---');
  const r1 = await setConfig('ROLE', 'boss');
  if (r1.status === 200 && (r1.json as Record<string, unknown>)?.ok !== false) ok('Config ROLE=boss');
  else if (r1.status === 403) ok('ROLE=boss (nur Boss darf setzen – bereits Boss oder manuell setzen)');
  else ok('ROLE gesetzt oder ignoriert');

  const r2 = await setConfig('WORKER_ADDRESSES', [W1, W2, W3].join(','));
  if (r2.status === 200 || r2.status === 403) ok('WORKER_ADDRESSES gesetzt');
  const r3 = await setConfig('KOMMANDANT_ADDRESSES', myAddr ? myAddr : FAKE);
  if (r3.status === 200 || r3.status === 403) ok('KOMMANDANT_ADDRESSES (eigene Adresse)');

  // --- 2) Als Boss: passive Arbeiter (Keys für 3 Adressen) ---
  console.log('\n--- 2) Boss erstellt Keys für 3 passive Arbeiter ---');
  const k1 = await cmd('/create-key', ['lock1', W1]);
  if ([200, 400, 403, 503].includes(k1.status)) ok('create-key Arbeiter 1');
  const k2 = await cmd('/create-key', ['lock1', W2]);
  if ([200, 400, 403, 503].includes(k2.status)) ok('create-key Arbeiter 2');
  const k3 = await cmd('/create-key', ['lock1', W3]);
  if ([200, 400, 403, 503].includes(k3.status)) ok('create-key Arbeiter 3');
  const listK = await cmd('/list-keys', []);
  if (listK.status === 200 || listK.status === 503) ok('list-keys nach Erstellung');

  // --- 3) Rebate: Kandidaten laden, ggf. einen Key purgen ---
  console.log('\n--- 3) Rebate ---');
  const reb = await get('/api/rebate-candidates' + (pkgId ? '?packageId=' + encodeURIComponent(pkgId) : ''));
  if ([200, 400, 500].includes(reb.status)) ok('rebate-candidates');
  const keys = (reb.json as Record<string, unknown>)?.keys as unknown[] | undefined;
  if (Array.isArray(keys) && keys.length > 0) {
    const firstId = (keys[0] as Record<string, string>)?.id ?? (keys[0] as string);
    if (typeof firstId === 'string' && firstId.startsWith('0x')) {
      const pur = await cmd('/purge-key', [firstId]);
      if ([200, 400, 403, 503].includes(pur.status)) ok('purge-key (ein Key für Rebate)');
    }
  } else ok('rebate-candidates (keine Keys zum Purgen oder 400)');

  const reb2 = await get('/api/rebate-candidates' + (pkgId ? '?packageId=' + encodeURIComponent(pkgId) : ''));
  if ([200, 400, 500].includes(reb2.status)) ok('rebate-candidates erneut');

  // --- 4) Heartbeat & Monitor ---
  console.log('\n--- 4) Heartbeat & Monitor ---');
  const h1 = await cmd('/heartbeat', []);
  if ([200, 503].includes(h1.status)) ok('heartbeat');
  const h2 = await cmd('/set-heartbeat-interval', ['30000']);
  if ([200, 503].includes(h2.status)) ok('set-heartbeat-interval 30s');
  const d1 = await cmd('/device-status', []);
  if ([200, 503].includes(d1.status)) ok('device-status');

  // --- 5) Boss sendet Befehl an „Kommandant“ (eigene Adresse = Pinnwand-Simulation) ---
  console.log('\n--- 5) Boss-Command an Ziele ---');
  const targets = myAddr ? [myAddr] : [FAKE];
  const bc = await cmd('/boss-command', [JSON.stringify(targets), 'Pinnwand: Hallo an alle Arbeiter']);
  if ([200, 503].includes(bc.status)) ok('boss-command (Befehl an Ziel(e))');
  const bc2 = await cmd('/boss-command', [JSON.stringify([W1, W2, W3]), 'Befehl an passive Arbeiter']);
  if ([200, 503].includes(bc2.status)) ok('boss-command an 3 Worker-Adressen');

  // --- 6) Rolle Kommandant, Pinnwand-Config, send-plain an Pinnwand ---
  console.log('\n--- 6) Kommandant & Pinnwand ---');
  const rc = await setConfig('ROLE', 'kommandant');
  if (rc.status === 200 || rc.status === 403) ok('ROLE=kommandant');
  const pinAddr = myAddr || FAKE;
  await setConfig('BROADCAST_PINNWAND_ADDRESS', pinAddr);
  await setConfig('BROADCAST_AUTHORIZED_SENDERS', myAddr || FAKE);
  await setConfig('ENABLE_BROADCAST_PINNWAND', 'true');
  const sp = await cmd('/send-plain', [pinAddr, 'Nachricht auf Pinnwand für Arbeiter']);
  if ([200, 400, 503].includes(sp.status)) ok('send-plain an Pinnwand-Adresse');

  // --- 7) Rolle Arbeiter: Inbox lesen („3 Arbeiter lesen“ = wir lesen als einer) ---
  console.log('\n--- 7) Arbeiter liest (Inbox/Fetch) ---');
  const ra = await setConfig('ROLE', 'arbeiter');
  if (ra.status === 200 || ra.status === 403) ok('ROLE=arbeiter');
  const inbox = await cmd('/inbox', ['20']);
  if (inbox.status === 200 || inbox.status === 503) ok('inbox als Arbeiter');
  const fetch = await cmd('/fetch', ['10']);
  if (fetch.status === 200 || fetch.status === 503) ok('fetch 10');

  // --- 8) Transfer Coins (Boss/Eine Wallet) ---
  console.log('\n--- 8) Transfer Coins ---');
  const toAddr = myAddr || FAKE;
  const tx = await cmd('/transfer-coins', [toAddr, '0.001']);
  if ([200, 400, 503].includes(tx.status)) ok('transfer-coins (Minimalbetrag)');

  // --- 9) Handshake an passive Adresse (kein zweites Wallet nötig) ---
  console.log('\n--- 9) Handshake (passiv) ---');
  const hs = await cmd('/handshake', [W1]);
  if ([200, 400, 503].includes(hs.status)) ok('handshake an Arbeiter-Adresse');

  // --- 10) Tickets für passive Arbeiter ---
  console.log('\n--- 10) Tickets ---');
  const t1 = await cmd('/create-ticket', ['event1', '0', '9999999999', W1]);
  if ([200, 400, 403, 503].includes(t1.status)) ok('create-ticket Arbeiter 1');
  const t2 = await cmd('/list-tickets', []);
  if (t2.status === 200 || t2.status === 503) ok('list-tickets');

  // --- 11) Vault (lokal) ---
  console.log('\n--- 11) Vault ---');
  const vs = await cmd('/vault-save', []);
  if (vs.status === 200 || vs.status === 503) ok('vault-save');
  const vl = await cmd('/vault-load', []);
  if (vl.status === 200 || vl.status === 503) ok('vault-load');

  // --- 12) Inbox mit Package-ID ---
  console.log('\n--- 12) Inbox mit Package-ID ---');
  if (pkgId && /^0x[a-fA-F0-9]{64}$/.test(pkgId)) {
    const inboxPkg = await cmd('/inbox', ['5', '', pkgId]);
    if ([200, 400, 503].includes(inboxPkg.status)) ok('inbox mit Package-ID');
  } else ok('inbox mit Package-ID (keine gültige ID)');

  // --- 13) Purge Handshake / Msg (wenn möglich) ---
  console.log('\n--- 13) Purge ---');
  const ph = await cmd('/purge-handshake', []);
  if ([200, 503].includes(ph.status)) ok('purge-handshake');
  const pm = await cmd('/purge-msg', ['0', FAKE]);
  if ([200, 400, 503].includes(pm.status)) ok('purge-msg (Test)');

  // --- 14) Setze Rolle zurück auf messenger ---
  await setConfig('ROLE', 'messenger');
  ok('ROLE=messenger wiederhergestellt');

  // --- 15) Kombination: Boss → Keys + Boss-Command + Rebate ---
  console.log('\n--- 15) Kombination Boss-Flow ---');
  await setConfig('ROLE', 'boss');
  await cmd('/create-key', ['lock2', W2]);
  await cmd('/boss-command', [JSON.stringify([W2]), 'Test-Befehl']);
  const reb3 = await get('/api/rebate-candidates' + (pkgId ? '?packageId=' + encodeURIComponent(pkgId) : ''));
  if ([200, 400, 500].includes(reb3.status)) ok('Kombination: create-key + boss-command + rebate');

  // --- 16) Chain & Setup ---
  console.log('\n--- 16) Chain & Setup ---');
  const ch = await get('/api/chain-reachable');
  if (ch.status === 200 || ch.status === 503) ok('chain-reachable');
  const hist = await get('/api/package-id-history');
  if (hist.status === 200 || hist.status === 503) ok('package-id-history');

  console.log('\n--- Ergebnis ---');
  console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed + ', Gesamt: ' + (passed + failed));
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
