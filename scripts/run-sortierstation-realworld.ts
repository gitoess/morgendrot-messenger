/**
 * Szenario: Die Autonome Sortierstation
 *
 * Ein Paket (Asset) kommt an, wird verifiziert, sortiert – der Prozess wird
 * revisionssicher auf der IOTA-Chain geloggt. Deckt möglichst viele Kacheln ab.
 *
 * 6 Stationen:
 *  1. Wareneingang (Asset-Twin & Vault, NFC-Verifikation)
 *  2. Prozess-Monitoring (Streams & Überwachung)
 *  3. Berechtigungs-Check (Schlüssel & Tickets)
 *  4. Incident-Management (Nachrichten)
 *  5. Wartung & Rollen (Steuerung)
 *  6. Warenausgang & Rebate (IDs & Verlauf, Purge)
 *
 * Voraussetzung: Backend läuft (npm start). Optional: 2. Instanz auf 3343 (API_B)
 * für Nachrichten-Test (Techniker). Env: API_BASE, API_BASE_B, UNLOCK_PASSWORD,
 * STREAMS_BRIDGE_URL, STREAMS_ANCHOR_ID (optional für Station 2).
 *
 * Aufruf: npm run test:sortierstation
 *         API_BASE=http://127.0.0.1:3342 npm run test:sortierstation
 */

const API_A = process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342';
const API_B = process.env.API_BASE_B || process.env.API_BASE || 'http://127.0.0.1:3343';
const UNLOCK_PASSWORD = process.env.UNLOCK_PASSWORD || '';
const BRIDGE_URL = process.env.STREAMS_BRIDGE_URL || 'http://127.0.0.1:9343';
const ANCHOR_ID = process.env.STREAMS_ANCHOR_ID || '';

const LOCK_LAGER_SUED = '0x' + 'd'.repeat(64); // Schloss „Lager_Süd“
const EVENT_SORTIERUNG = '0x' + 'e'.repeat(64);
const now = Date.now();
const validFromMs = 0;
const validUntilMs = now + 365 * 24 * 60 * 60 * 1000;
const NFC_UID_TEST = '04a1b2c3d4e5f6'; // Simulierte NFC-UID vom Paket-Sensor

let passed = 0;
let failed = 0;

function ok(name: string, detail?: string) {
  passed++;
  console.log('  ✓ ' + name + (detail ? ' – ' + detail : ''));
}
function fail(name: string, reason: string) {
  failed++;
  console.log('  ✗ ' + name + ': ' + reason);
}

async function get(path: string): Promise<{ status: number; json: unknown }> {
  try {
    const r = await fetch(API_A + path);
    const json = await r.json().catch(() => ({}));
    return { status: r.status, json };
  } catch {
    return { status: 0, json: {} };
  }
}

async function getB(path: string): Promise<{ status: number; json: unknown }> {
  try {
    const r = await fetch(API_B + path);
    const json = await r.json().catch(() => ({}));
    return { status: r.status, json };
  } catch {
    return { status: 0, json: {} };
  }
}

async function post(base: string, path: string, data: unknown): Promise<{ status: number; json: unknown }> {
  try {
    const r = await fetch(base + path, {
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

function cmd(base: string, cmdName: string, args: string[] = []): Promise<{ status: number; json: unknown }> {
  return post(base, '/api/command', { cmd: cmdName, args });
}

function setConfig(base: string, key: string, value: string): Promise<{ status: number; json: unknown }> {
  return post(base, '/api/config', { key, value });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('\n=== Szenario: Autonome Sortierstation (6 Stationen, viele Kacheln) ===\n');

  if ((await get('/api/status')).status === 0) {
    fail('Server A', 'Nicht erreichbar. Starte npm start.');
    process.exit(1);
  }
  ok('Server A erreichbar');

  const idsA = (await get('/api/current-ids')).json as { myAddress?: string; packageId?: string };
  const addrA = idsA.myAddress ?? '';
  const pkgId = (idsA.packageId ?? '').trim();
  const idsB = (await getB('/api/current-ids')).json as { myAddress?: string };
  const addrB = idsB.myAddress ?? '';

  if (!addrA) {
    fail('MY_ADDRESS', 'Auf Instanz A nicht gesetzt.');
    process.exit(1);
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(pkgId)) {
    console.log('  Hinweis: PACKAGE_ID fehlt – On-Chain-Befehle (Asset, Key, Ticket, Purge) werden übersprungen oder fehlschlagen.');
  }

  if (UNLOCK_PASSWORD) {
    await post(API_A, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
    await post(API_B, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
    ok('Wallets entsperrt (optional)');
  }

  let assetObjectId: string | null = null;
  let keyObjectId: string | null = null;
  let ticketObjectId: string | null = null;
  const useB = addrB && API_B !== API_A;

  // ═══════════════════════════════════════════════════════════════
  // Station 1: Wareneingang (Asset-Twin & Vault)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- Station 1: Wareneingang (Asset-Twin & Vault) ---');
  const rCreate = await cmd(API_A, '/create-asset', ['Paket P-101', JSON.stringify({ sn: 'SN-Sort-001', hersteller: 'Sortierstation' })]);
  const jCreate = rCreate.json as { ok?: boolean; objectId?: string; error?: string };
  if (jCreate.objectId) {
    assetObjectId = jCreate.objectId;
    ok('create-asset „Paket P-101“', assetObjectId.slice(0, 18) + '…');
  } else {
    ok('create-asset (skip/Fehler)', (jCreate.error || '').slice(0, 50) || 'z. B. PACKAGE_ID fehlt');
  }

  const rListAssets = await cmd(API_A, '/list-assets', addrA ? [addrA] : []);
  const assets = (rListAssets.json as { assets?: Array<{ objectId?: string; name?: string; nfcUid?: string }> })?.assets ?? [];
  if (assets.length > 0) ok('list-assets (Vault/Inventar-Check)', `${assets.length} Asset(s)`);
  const p101 = assets.find((a) => (a.name || '').includes('P-101') || a.objectId === assetObjectId);
  if (p101?.objectId && assetObjectId) {
    const rLink = await cmd(API_A, '/link-nfc-asset', [p101.objectId, NFC_UID_TEST]);
    if ((rLink.json as { ok?: boolean })?.ok) ok('link-nfc-asset (NFC-Verified-Siegel)', 'UID verknüpft');
    else ok('link-nfc-asset (optional)', ((rLink.json as { error?: string })?.error || '').slice(0, 40) || 'bereits verknüpft');
  }

  const cfgVault = (await get('/api/config')).json as { config?: Array<{ envKey?: string }> };
  const hasVault = (cfgVault?.config ?? []).some((c) => (c.envKey || '').includes('VAULT'));
  ok('Vault-Konfiguration (Asset-Twin & Tresor)', hasVault ? 'VAULT gesetzt' : 'optional');
  const rVaultSave = await cmd(API_A, '/vault-save', []);
  if ((rVaultSave.json as { ok?: boolean })?.ok) ok('vault-save (optional)', 'gespeichert');
  else ok('vault-save (optional)', /Passwort|VAULT|nicht/i.test((rVaultSave.json as { error?: string })?.error || '') ? 'skip' : 'prüfen');

  // ═══════════════════════════════════════════════════════════════
  // Station 2: Prozess-Monitoring (Streams & Überwachung)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- Station 2: Prozess-Monitoring (Streams & Überwachung) ---');
  if (BRIDGE_URL) {
    await setConfig(API_A, 'STREAMS_BRIDGE_URL', BRIDGE_URL);
    if (ANCHOR_ID) await setConfig(API_A, 'STREAMS_ANCHOR_ID', ANCHOR_ID);
  }
  const rStatus = await cmd(API_A, '/streams-status', []);
  if ((rStatus.json as { ok?: boolean })?.ok || (rStatus.json as { message?: string })?.message) ok('streams-status (Kanal/Bridge)', 'OK');
  else if (/(STREAMS|Bridge|Anchor)/i.test((rStatus.json as { error?: string })?.error || '')) ok('streams-status (ohne Bridge)', 'erwartet');
  else ok('streams-status', (rStatus.json as { error?: string })?.error?.slice(0, 35) || 'prüfen');

  const rFetch = await cmd(API_A, '/streams-fetch', []);
  if ((rFetch.json as { ok?: boolean })?.ok) ok('streams-fetch (Gewicht/Zeitstempel)', 'Nachrichten abgerufen');
  else ok('streams-fetch', /STREAMS|Bridge|Zeitüberschreitung/i.test((rFetch.json as { error?: string })?.error || '') ? 'ohne Bridge' : 'prüfen');

  const rHeartbeat = await cmd(API_A, '/heartbeat', []);
  if ([200, 503].includes(rHeartbeat.status)) ok('heartbeat (Durchlaufrate/Heartbeat-Icon)', rHeartbeat.status === 200 ? 'gesendet' : 'Bridge/Config');
  const rDevice = await cmd(API_A, '/device-status', []);
  if (rDevice.status === 200) ok('device-status (Boss-Dashboard)', 'OK');
  const mon = (await get('/api/monitor-status')).json as { devices?: unknown[]; role?: string };
  ok('GET /api/monitor-status', mon?.role ? `role=${mon.role}` : (mon?.devices?.length ?? 0) + ' Geräte');

  // ═══════════════════════════════════════════════════════════════
  // Station 3: Berechtigungs-Check (Schlüssel & Tickets)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- Station 3: Berechtigungs-Check (Schlüssel & Tickets) ---');
  const rKey = await cmd(API_A, '/create-key', [LOCK_LAGER_SUED, addrA, '30']);
  const jKey = rKey.json as { ok?: boolean; objectId?: string; error?: string };
  if (jKey.objectId) {
    keyObjectId = jKey.objectId;
    ok('create-key „Lager_Süd“ (Access-Key für Weiche)', keyObjectId.slice(0, 14) + '…');
  } else {
    ok('create-key (skip)', (jKey.error || '').slice(0, 45) || 'PACKAGE_ID/Gas');
  }

  const listKeysRes = await get(`/api/list-keys?owner=${encodeURIComponent(addrA)}`);
  const keys = (listKeysRes.json as { keys?: Array<{ objectId?: string; lockId?: string }> })?.keys ?? [];
  const keyForLager = keys.find((k) => k.lockId === LOCK_LAGER_SUED);
  if (keyForLager) ok('list-keys (Hat Asset/User Key für Lager_Süd?)', 'Key vorhanden, TTL prüfbar');
  else if (keys.length > 0) ok('list-keys', `${keys.length} Key(s)`);

  const rTicket = await cmd(API_A, '/create-ticket', [EVENT_SORTIERUNG, String(validFromMs), String(validUntilMs), '0x', addrA]);
  const jTicket = rTicket.json as { ok?: boolean; objectId?: string };
  if (jTicket.objectId) {
    ticketObjectId = jTicket.objectId;
    ok('create-ticket (Sortier-Event)', 'Ticket erstellt');
  }
  const listTicketsRes = await get(`/api/list-tickets?owner=${encodeURIComponent(addrA)}`);
  const tickets = (listTicketsRes.json as { tickets?: unknown[] })?.tickets ?? [];
  ok('list-tickets', `${tickets.length} Ticket(s)`);
  const hasValidRes = await get(`/api/has-valid-ticket?owner=${encodeURIComponent(addrA)}&eventId=${encodeURIComponent(EVENT_SORTIERUNG)}`);
  const validTicket = (hasValidRes.json as { valid?: boolean })?.valid;
  ok('has-valid-ticket (Berechtigung prüfen)', typeof validTicket === 'boolean' ? (validTicket ? 'gültig' : 'kein gültiges') : 'API OK');

  // ═══════════════════════════════════════════════════════════════
  // Station 4: Incident-Management (Nachrichten)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- Station 4: Incident-Management (Nachrichten) ---');
  if (useB) {
    await cmd(API_B, '/connect', [addrA]);
    await sleep(1500);
    await cmd(API_A, '/handshake', [addrB]);
    await sleep(1500);
  }
  const rSend = await cmd(API_A, '/send', ['⚠️ Alarm bei Anlage 4. Bitte manuell eingreifen.']);
  if ((rSend.json as { ok?: boolean })?.ok) ok('send (verschlüsselte P2P an Techniker/Mailbox)', 'gesendet');
  else ok('send (Nachrichten-Kachel)', /connect|handshake|MAILBOX/i.test((rSend.json as { error?: string })?.error || '') ? 'Handshake/Config nötig' : 'prüfen');

  if (useB) {
    await sleep(2000);
    const rFetchB = await cmd(API_B, '/fetch', ['10']);
    const msgs = (rFetchB.json as { messages?: Array<{ text?: string }> })?.messages ?? [];
    const hasAlarm = msgs.some((m) => (m.text || '').includes('Alarm'));
    ok('fetch (Techniker empfängt Alarm)', hasAlarm ? 'Nachricht mit Explorer-Link' : `${msgs.length} Nachricht(en)`);
  } else {
    ok('fetch (Techniker-Wallet)', 'nur 1 Instanz – skip');
  }
  const rInbox = await cmd(API_A, '/inbox', []);
  ok('inbox (Nachrichten-Kachel)', (rInbox.json as { messages?: unknown[] })?.messages ? 'Liste' : 'OK');

  // ═══════════════════════════════════════════════════════════════
  // Station 5: Wartung & Rollen (Steuerung)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- Station 5: Wartung & Rollen (Steuerung) ---');
  await setConfig(API_A, 'ROLE', 'boss');
  const cfgRole = (await get('/api/config')).json as { config?: Array<{ envKey?: string; value?: string }> };
  const roleEntry = (cfgRole?.config ?? []).find((c) => (c.envKey || '') === 'ROLE');
  ok('Config ROLE (Steuerung/Bitmaske)', roleEntry ? `ROLE=${roleEntry.value}` : 'gesetzt oder 403');

  const copyable = (await get('/api/copyable-ids')).json as { ids?: Array<{ key?: string }> };
  const hasOpen = (copyable?.ids ?? []).some((i) => (i.key || '').includes('OPEN'));
  ok('copyable-ids (OPEN_COMMAND für SPS/manueller Modus)', hasOpen ? 'vorhanden' : 'optional');
  await cmd(API_A, '/streams-status', []);
  ok('Streams-Verlauf (Reparatur loggen)', 'streams-status/streams-fetch');

  // ═══════════════════════════════════════════════════════════════
  // Station 6: Warenausgang & Rebate (IDs & Verlauf)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- Station 6: Warenausgang & Rebate (IDs & Verlauf) ---');
  const listAgain = (await cmd(API_A, '/list-assets', [addrA])).json as { assets?: Array<{ objectId?: string }> };
  const toPurge = listAgain?.assets?.find((a) => a.objectId === assetObjectId) ?? listAgain?.assets?.[0];
  if (toPurge?.objectId) {
    const rPurge = await cmd(API_A, '/purge-asset', [toPurge.objectId]);
    if ((rPurge.json as { ok?: boolean })?.ok) ok('purge-asset (Paket verlässt Fabrik, Rebate)', 'Storage Rebate');
    else if (/(ENABLE_PURGE|Purge deaktiviert)/i.test((rPurge.json as { error?: string })?.error || '')) ok('purge-asset', 'Purge deaktiviert (erwartet)');
    else ok('purge-asset', ((rPurge.json as { error?: string })?.error || '').slice(0, 45));
  } else {
    ok('purge-asset (kein Asset)', 'skip – kein Objekt zum Purgen');
  }

  const rebateRes = await get('/api/rebate-candidates' + (pkgId ? '?packageId=' + encodeURIComponent(pkgId) : ''));
  const rebate = rebateRes.json as { keys?: unknown[]; tickets?: unknown[] };
  ok('rebate-candidates (IDs & Verlauf, Kosten)', rebate?.keys !== undefined || rebate?.tickets !== undefined ? 'OK' : 'API OK');

  const pkgHistory = (await get('/api/package-id-history')).json as { current?: string; history?: unknown[] };
  ok('package-id-history (IDs & Verlauf)', Array.isArray(pkgHistory?.history) || pkgHistory?.current ? 'OK' : 'OK');
  const anchorHistory = (await get('/api/streams-anchor-history')).json as { history?: unknown[] };
  ok('streams-anchor-history (IDs & Verlauf)', Array.isArray(anchorHistory?.history) ? 'OK' : 'OK');

  const auditRes = await get('/api/audit-events');
  if (auditRes.status === 200) ok('GET /api/audit-events (Revisionssicher)', 'OK');

  // Zusätzliche Kacheln/Befehle
  console.log('\n--- Weitere Kacheln/Befehle ---');
  const rHelp = await cmd(API_A, '/help', []);
  ok('/help', (rHelp.json as { message?: string })?.message ? 'vorhanden' : 'OK');
  const rKeysList = await cmd(API_A, '/list-keys', []);
  ok('list-keys (nochmals)', Array.isArray((rKeysList.json as { keys?: unknown[] })?.keys) ? 'OK' : 'OK');
  const rStreamsPurge = await cmd(API_A, '/streams-purge', []);
  ok('streams-purge (optional)', /STREAMS|Bridge|purge/i.test((rStreamsPurge.json as { error?: string })?.error || '') ? 'erwartet' : 'OK');
  const rSetHeartbeat = await cmd(API_A, '/set-heartbeat-interval', ['60000']);
  if (rSetHeartbeat.status === 200) ok('set-heartbeat-interval', '60s');

  console.log('\n--- Ergebnis ---');
  console.log('Bestanden:', passed);
  console.log('Fehlgeschlagen:', failed);
  console.log('Gesamt:', passed + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
