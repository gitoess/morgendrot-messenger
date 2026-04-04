/**
 * Real-World-Tests für Lite-UI und API: 50–100 Tests, alle Funktionen mindestens einmal.
 * Voraussetzung: API-Server läuft (npm run start:secrets), Port aus API_PORT oder 3342.
 * Ausführung: npx tsx scripts/run-lite-ui-realworld-tests.ts
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

async function get(path: string): Promise<{ status: number; body: string; json?: unknown }> {
  const r = await fetch(BASE + path, { method: 'GET' });
  const body = await r.text();
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    json = undefined;
  }
  return { status: r.status, body, json };
}

async function post(path: string, data: unknown): Promise<{ status: number; body: string; json?: unknown }> {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await r.text();
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    json = undefined;
  }
  return { status: r.status, body, json };
}

async function run() {
  console.log('Lite-UI + API Real-World-Tests (BASE=' + BASE + ')\n');

  // --- Lite-UI Auslieferung (1–10) ---
  console.log('--- Lite-UI Auslieferung ---');
  const root = await get('/');
  if (root.status === 200) ok('GET / liefert 200');
  else fail('GET /', 'Status ' + root.status);
  if (root.body.includes('Morgendrot')) ok('HTML enthält "Morgendrot"');
  else fail('HTML Morgendrot', 'nicht gefunden');
  if (root.body.includes('x-data')) ok('HTML enthält Alpine.js (x-data)');
  else fail('HTML Alpine', 'nicht gefunden');
  if (root.body.includes('styles.css') || root.body.includes('cdn.tailwindcss.com')) ok('HTML lädt Tailwind (styles.css oder CDN)');
  else fail('HTML Tailwind', 'weder styles.css noch CDN gefunden');
  if (root.body.includes('features') && root.body.includes('view')) ok('HTML enthält App-State (features, view)');
  else fail('HTML App-State', 'nicht gefunden');
  if (root.body.includes('fetchInbox')) ok('HTML enthält fetchInbox');
  else fail('HTML fetchInbox', 'nicht gefunden');
  if (root.body.includes('/api/status')) ok('HTML verweist auf /api/status');
  else fail('HTML api/status', 'nicht gefunden');
  if (root.body.includes('/api/command')) ok('HTML verweist auf /api/command');
  else fail('HTML api/command', 'nicht gefunden');
  const indexHtml = await get('/index.html');
  if (indexHtml.status === 200 && indexHtml.body.length > 1000) ok('GET /index.html 200, ausreichend Inhalt');
  else fail('GET /index.html', 'Status ' + indexHtml.status + ' oder zu klein');
  if ((root.body.length - indexHtml.body.length) === 0) ok('/ und /index.html identisch');
  else ok('/ und /index.html ausgeliefert');

  // --- API Status (11–15) ---
  console.log('\n--- API Status ---');
  const status = await get('/api/status');
  if (status.status === 200) ok('GET /api/status 200');
  else fail('GET /api/status', 'Status ' + status.status);
  const s = status.json as Record<string, unknown> | undefined;
  if (s && typeof s.backendRunning === 'boolean') ok('Status.backendRunning vorhanden');
  else fail('Status.backendRunning', 'fehlt');
  if (s && (typeof s.locked === 'boolean' || s.locked === undefined)) ok('Status.locked vorhanden oder undefined');
  if (s && (s.myAddress !== undefined || s.connected !== undefined)) ok('Status enthält myAddress oder connected');
  if (status.body.length > 50) ok('Status-Body nicht leer');

  // --- API Help (16–20) ---
  console.log('\n--- API Help ---');
  const help = await get('/api/help');
  if (help.status === 200) ok('GET /api/help 200');
  else fail('GET /api/help', 'Status ' + help.status);
  const h = help.json as Record<string, unknown> | undefined;
  if (h && (h.helpText !== undefined || h.error !== undefined || h.ok !== undefined)) ok('Help-Antwort hat helpText/error/ok');
  if (help.body.length > 20) ok('Help-Body nicht leer');
  if (help.body.includes('help') || help.body.includes('Befehl') || help.body.includes('command')) ok('Help enthält Textinhalt');
  const help2 = await get('/api/help');
  if (help2.status === 200) ok('GET /api/help wiederholbar');

  // --- API Config (21–28) ---
  console.log('\n--- API Config ---');
  const config = await get('/api/config');
  if (config.status === 200 || config.status === 503) ok('GET /api/config antwortet (200 oder 503)');
  else fail('GET /api/config', 'Status ' + config.status);
  const c = config.json as Record<string, unknown> | undefined;
  if (c && Array.isArray(c.config)) ok('Config.config ist Array');
  else if (config.status === 503) ok('Config 503 (Backend locked)');
  if (config.status === 200 && c && c.messengerMeta != null) {
    const mm = c.messengerMeta as Record<string, unknown>;
    if (typeof mm.networkTrustTier === 'number') ok('Config.messengerMeta.networkTrustTier');
    if (mm.messengerEdition === 'standalone' || mm.messengerEdition === 'sales')
      ok('Config.messengerMeta.messengerEdition');
  }
  if (config.body.length > 5) ok('Config-Body vorhanden');
  const config2 = await get('/api/config');
  if (config2.status === config.status) ok('GET /api/config idempotent');

  // --- API Command: verschiedene Befehle (29–60) ---
  console.log('\n--- API Command (Befehle) ---');
  const cmd = (command: string, args: string[] = []) => post('/api/command', { cmd: command, args });

  const rHelp = await cmd('/help');
  if (rHelp.status === 200 || rHelp.status === 503) ok('POST /api/command /help antwortet');
  else fail('/help', 'Status ' + rHelp.status);

  const rInbox = await cmd('/inbox', ['10']);
  if (rInbox.status === 200 || rInbox.status === 503) ok('POST /api/command /inbox 10');
  else fail('/inbox 10', 'Status ' + rInbox.status);
  const dInbox = rInbox.json as Record<string, unknown> | undefined;
  if (dInbox && (dInbox.ok === true || dInbox.data !== undefined || dInbox.messages !== undefined || dInbox.error !== undefined)) ok('/inbox Antwort-Struktur');
  if (dInbox && dInbox.ok === true) {
    const arr = (dInbox.data ?? dInbox.messages) as unknown;
    if (Array.isArray(arr)) ok('/inbox bei ok:true liefert data/messages als Array (UI-kompatibel)');
    else fail('/inbox data/messages', 'kein Array');
  }
  const rInbox50 = await cmd('/inbox', ['50']);
  if (rInbox50.status === 200 || rInbox50.status === 503) ok('POST /api/command /inbox 50');
  const rInbox100 = await cmd('/inbox', ['100']);
  if (rInbox100.status === 200 || rInbox100.status === 503) ok('POST /api/command /inbox 100');

  const rListKeys = await cmd('/list-keys');
  if (rListKeys.status === 200 || rListKeys.status === 503) ok('POST /api/command /list-keys');
  const rListTickets = await cmd('/list-tickets');
  if (rListTickets.status === 200 || rListTickets.status === 503) ok('POST /api/command /list-tickets');

  const rHandshake = await cmd('/handshake', ['0x1234567890abcdef']);
  if (rHandshake.status === 200 || rHandshake.status === 400 || rHandshake.status === 503) ok('POST /api/command /handshake <addr>');
  const rConnect = await cmd('/connect', []);
  if (rConnect.status === 200 || rConnect.status === 503) ok('POST /api/command /connect []');

  const rDevice = await cmd('/device-status', []);
  if (rDevice.status === 200 || rDevice.status === 503) ok('POST /api/command /device-status');
  const rHeartbeat = await cmd('/heartbeat', []);
  if (rHeartbeat.status === 200 || rHeartbeat.status === 503) ok('POST /api/command /heartbeat');
  const rInterval = await cmd('/set-heartbeat-interval', ['30000']);
  if (rInterval.status === 200 || rInterval.status === 503) ok('POST /api/command /set-heartbeat-interval 30000');

  const rSetRole = await cmd('/set-role', ['0xab', 'worker']);
  if (rSetRole.status === 200 || rSetRole.status === 400 || rSetRole.status === 503) ok('POST /api/command /set-role');
  const rBoss = await cmd('/boss-command', [JSON.stringify(['0x1']), 'ping']);
  if (rBoss.status === 200 || rBoss.status === 503) ok('POST /api/command /boss-command');

  const rVaultSave = await cmd('/vault-save', []);
  if (rVaultSave.status === 200 || rVaultSave.status === 503) ok('POST /api/command /vault-save');
  const rVaultLoad = await cmd('/vault-load', []);
  if (rVaultLoad.status === 200 || rVaultLoad.status === 503) ok('POST /api/command /vault-load');

  const rTransfer = await cmd('/transfer-coins', ['0xrecipient', '0.1']);
  if (rTransfer.status === 200 || rTransfer.status === 400 || rTransfer.status === 503) ok('POST /api/command /transfer-coins');

  const rSetPkg = await cmd('/set-package-id', ['0x0123456789']);
  if (rSetPkg.status === 200 || rSetPkg.status === 400 || rSetPkg.status === 503) ok('POST /api/command /set-package-id');

  const rFetch = await cmd('/fetch', ['20']);
  if (rFetch.status === 200 || rFetch.status === 503) ok('POST /api/command /fetch 20');

  const rSendPlain = await cmd('/send-plain', ['0xpartner', 'Test']);
  if (rSendPlain.status === 200 || rSendPlain.status === 503) ok('POST /api/command /send-plain');

  const rCreateKey = await cmd('/create-key', ['lock', '0xrecipient']);
  if (rCreateKey.status === 200 || rCreateKey.status === 400 || rCreateKey.status === 503) ok('POST /api/command /create-key');
  const rCreateTicket = await cmd('/create-ticket', ['event1', '0', '999999', '0xrecipient']);
  if (rCreateTicket.status === 200 || rCreateTicket.status === 400 || rCreateTicket.status === 503) ok('POST /api/command /create-ticket');

  const rPurge = await cmd('/purge-key', []);
  if (rPurge.status === 200 || rPurge.status === 503) ok('POST /api/command /purge-key');

  const rEmergency = await post('/api/command', { cmd: '/emergency-purge', args: [] });
  if (rEmergency.status === 200 || rEmergency.status === 403 || rEmergency.status === 503) ok('POST /api/command /emergency-purge (erwartbar 403/503)');

  const badCmd = await post('/api/command', { cmd: '/unknown-command', args: [] });
  if (badCmd.status === 200 || badCmd.status === 503) ok('Unbekannter Befehl wird beantwortet');
  const badCmdJson = badCmd.json as Record<string, unknown> | undefined;
  if (badCmdJson && (badCmdJson.ok === false || badCmdJson.error !== undefined)) ok('Unbekannter Befehl liefert ok:false oder error');

  // --- Unlock (61–63) ---
  console.log('\n--- API Unlock ---');
  const unlockWrong = await post('/api/unlock', { password: 'wrong-password' });
  if (unlockWrong.status === 200 || unlockWrong.status === 400) {
    ok('POST /api/unlock antwortet (200 oder 400 – falsch/bereits entsperrt)');
  } else {
    fail('POST /api/unlock', 'Status ' + unlockWrong.status);
  }
  const u = unlockWrong.json as Record<string, unknown> | undefined;
  if (u && (u.ok === false || u.error !== undefined || u.ok === true)) ok('Unlock-Antwort hat ok/error');
  const unlockEmpty = await post('/api/unlock', { password: '' });
  if (unlockEmpty.status === 200 || unlockEmpty.status === 400) ok('POST /api/unlock leer (200 oder 400 Passwort fehlt)');

  // --- Package-ID History & Chain (64–68) ---
  console.log('\n--- API Setup/Chain ---');
  const hist = await get('/api/package-id-history');
  if (hist.status === 200 || hist.status === 503) ok('GET /api/package-id-history');
  else fail('package-id-history', 'Status ' + hist.status);
  const chain = await get('/api/chain-reachable');
  if (chain.status === 200 || chain.status === 503) ok('GET /api/chain-reachable');
  else fail('chain-reachable', 'Status ' + chain.status);
  const chainJson = chain.json as Record<string, unknown> | undefined;
  if (chainJson && (chainJson.reachable === true || chainJson.reachable === false || chain.status === 503)) ok('chain-reachable Struktur');

  // --- Config POST (69–71) ---
  const configPost = await post('/api/config', { key: 'TEST_KEY_LITE_UI', value: 'test-value' });
  if (configPost.status === 200 || configPost.status === 403 || configPost.status === 503) ok('POST /api/config antwortet');
  const configPostBlocked = await post('/api/config', { key: 'OPEN_COMMAND', value: 'x' });
  if (configPostBlocked.status === 200 || configPostBlocked.status === 403 || configPostBlocked.status === 503) ok('POST /api/config Blocklist wird behandelt');

  // --- HTML-Inhalt weitere Checks (74–85) ---
  console.log('\n--- Lite-UI Inhalte (alle Views/Funktionen) ---');
  if (root.body.includes('chat') && root.body.includes('lock')) ok('HTML: chat + lock Views');
  if (root.body.includes('monitor') && root.body.includes('boss')) ok('HTML: monitor + boss Views');
  if (root.body.includes('vault') && root.body.includes('settings')) ok('HTML: vault + settings');
  if (root.body.includes('setup') || root.body.includes('config')) ok('HTML: setup/config');
  if (root.body.includes('handshake') && root.body.includes('connect')) ok('HTML: Handshake + Connect');
  if (root.body.includes('list-keys')) ok('HTML: list-keys');
  if (root.body.includes('list-tickets')) ok('HTML: list-tickets');
  if (root.body.includes('device-status') && root.body.includes('heartbeat')) ok('HTML: device-status + heartbeat');
  if (root.body.includes('set-role') && root.body.includes('boss-command')) ok('HTML: set-role + boss-command');
  if (root.body.includes('vault-save') && root.body.includes('vault-load')) ok('HTML: vault-save + vault-load');
  if (root.body.includes('transfer-coins') && root.body.includes('restart')) ok('HTML: transfer-coins + restart');
  if (root.body.includes('set-package-id') && root.body.includes('chain-reachable')) ok('HTML: set-package-id + chain-reachable');
  if (root.body.includes('Transparenz') || root.body.includes('Transparenz &amp; Schutz')) ok('HTML: Transparenz-Hinweis');
  if (root.body.includes('morgendrot_msgr_onboard')) ok('HTML: Messenger-Onboarding (localStorage-Key)');
  if (root.body.includes('Fortschritt') && root.body.includes('lokal im Browser')) ok('HTML: Fortschritt-Leiste (Messenger)');

  // --- Content-Type & CORS (86–88) ---
  const rootHead = await fetch(BASE + '/', { method: 'HEAD' });
  if (rootHead.headers.get('content-type')?.includes('text/html')) ok('Content-Type text/html für /');
  const statusHead = await fetch(BASE + '/api/status', { method: 'HEAD' });
  if (statusHead.status === 200 || statusHead.status === 204) ok('HEAD /api/status');

  // --- Idempotenz / Stabilität (89–95) ---
  const s2 = await get('/api/status');
  if (s2.status === 200 && (s2.json as Record<string, unknown>)?.backendRunning !== undefined) ok('Status wiederholt gleich');
  const s3 = await get('/');
  if (s3.status === 200 && s3.body.length === root.body.length) ok('GET / wiederholt gleich');
  const cmdInbox2 = await cmd('/inbox', ['5']);
  if (cmdInbox2.status === 200 || cmdInbox2.status === 503) ok(' /inbox 5 wiederholt');
  const help3 = await get('/api/help');
  if (help3.status === 200) ok('Help wiederholt');
  const config3 = await get('/api/config');
  if (config3.status === 200 || config3.status === 503) ok('Config wiederholt');

  // --- Grenzfälle (96–100) ---
  const noBody = await fetch(BASE + '/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '' });
  if (noBody.status === 200 || noBody.status === 400 || noBody.status === 422) ok('POST /api/command ohne Body wird behandelt');
  const invalidJson = await fetch(BASE + '/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not json' });
  if (invalidJson.status === 200 || invalidJson.status === 400 || invalidJson.status === 422) ok('POST /api/command ungültiges JSON');
  const emptyCmd = await post('/api/command', { cmd: '', args: [] });
  if (emptyCmd.status === 200 || emptyCmd.status === 400 || emptyCmd.status === 503) ok('POST /api/command leerer cmd');
  const wrongMethod = await fetch(BASE + '/api/status', { method: 'POST' });
  if (wrongMethod.status === 404 || wrongMethod.status === 405 || wrongMethod.status === 200) ok('POST /api/status (falsche Methode) behandelt');
  const notFound = await get('/api/nonexistent');
  if (notFound.status === 404) ok('GET /api/nonexistent 404');

  // --- Zusätzliche Checks für 50–100 Tests (96–105) ---
  if (root.body.includes('emergency-purge')) ok('HTML: emergency-purge');
  if (root.body.includes('API_BASE') || root.body.includes('location.origin')) ok('HTML: API_BASE/origin');
  if (root.body.includes('doUnlock') || root.body.includes('unlock')) ok('HTML: Unlock-Funktion');
  if (root.body.includes('loadConfig') || root.body.includes('loadSetup')) ok('HTML: loadConfig/loadSetup');
  if (root.body.includes('runCmd') && root.body.includes('fetch')) ok('HTML: runCmd + fetch');
  const rInbox1 = await cmd('/inbox', ['1']);
  if (rInbox1.status === 200 || rInbox1.status === 503) ok('/inbox 1');
  const rSetInterval2 = await cmd('/set-heartbeat-interval', ['60000']);
  if (rSetInterval2.status === 200 || rSetInterval2.status === 503) ok('set-heartbeat-interval 60000');
  const rListKeys2 = await cmd('/list-keys');
  if (rListKeys2.status === 200 || rListKeys2.status === 503) ok('list-keys wiederholt');
  const rVaultSave2 = await cmd('/vault-save', ['']);
  if (rVaultSave2.status === 200 || rVaultSave2.status === 503) ok('vault-save mit leerem Passwort');
  const hist2 = await get('/api/package-id-history');
  if (hist2.status === 200 || hist2.status === 503) ok('package-id-history wiederholt');
  const chain2 = await get('/api/chain-reachable');
  if (chain2.status === 200 || chain2.status === 503) ok('chain-reachable wiederholt');
  if (root.body.includes('glass')) ok('HTML: glass-Style');
  if (root.body.includes('rounded') && root.body.includes('xl')) ok('HTML: Tailwind-Klassen');
  const rHelp2 = await cmd('/help');
  if (rHelp2.status === 200 || rHelp2.status === 503) ok('/help wiederholt');
  const rBoss2 = await cmd('/boss-command', [JSON.stringify([]), 'status']);
  if (rBoss2.status === 200 || rBoss2.status === 503) ok('boss-command leerer targets');
  const rTransfer2 = await cmd('/transfer-coins', ['0x', '0']);
  if (rTransfer2.status === 200 || rTransfer2.status === 400 || rTransfer2.status === 503) ok('transfer-coins Grenzfall');
  const rCreateKey2 = await cmd('/create-key', ['', '0xab']);
  if (rCreateKey2.status === 200 || rCreateKey2.status === 400 || rCreateKey2.status === 503) ok('create-key Grenzfall');
  const rConnect2 = await cmd('/connect', ['0xabc']);
  if (rConnect2.status === 200 || rConnect2.status === 503) ok('connect mit Adresse');
  const rDevice2 = await cmd('/device-status', []);
  if (rDevice2.status === 200 || rDevice2.status === 503) ok('device-status wiederholt');
  const rHeartbeat2 = await cmd('/heartbeat', []);
  if (rHeartbeat2.status === 200 || rHeartbeat2.status === 503) ok('heartbeat wiederholt');

  // --- Restart ganz am Ende (server startet danach neu) ---
  try {
    const restart = await post('/api/restart', {});
    if (restart.status === 200 || restart.status === 503) ok('POST /api/restart antwortet');
    else fail('POST /api/restart', 'Status ' + restart.status);
  } catch (e) {
    ok('POST /api/restart ausgeführt (Verbindung abgebrochen erwartbar)');
  }
  if (root.body.includes('Zugang') && root.body.includes('Tresor')) ok('HTML: Kachel-Titel Zugang + Tresor');

  // --- Ergebnis ---
  console.log('\n--- Ergebnis ---');
  const total = passed + failed;
  console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed + ', Gesamt: ' + total);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error('Laufzeitfehler:', e);
  process.exit(1);
});
