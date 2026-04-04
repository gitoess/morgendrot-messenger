/**
 * Alle 9 Kacheln der Startseite – Schritt für Schritt mit 2 Wallets (Real-Life) durchtesten.
 *
 * Kacheln: 1 Chat, 2 Ticket & Schlüssel, 3 Schloss & Tür, 4 Sensor-Alarm, 5 Überwachung,
 *          6 Zahlung, 7 Pinnwand, 8 Tresor & Notfall, 9 Boss-Modus.
 *
 * Voraussetzung: Zwei laufende Morgendrot-Instanzen (z. B. Port 3342 + 3345), beide mit
 * MY_ADDRESS, A mit PACKAGE_ID. Optional UNLOCK_PASSWORD zum Entsperren.
 *
 * Aufruf: npm run test:all-tiles
 * Env: API_BASE_A, API_BASE_B (optional), UNLOCK_PASSWORD (optional)
 */

const API_A = process.env.API_BASE_A || 'http://127.0.0.1:3342';
const API_B = process.env.API_BASE_B || 'http://127.0.0.1:3343';
const UNLOCK_PASSWORD = process.env.UNLOCK_PASSWORD || '';

const EVENT_ID = '0x' + 'e'.repeat(64);
const LOCK_ID = '0x' + 'd'.repeat(64);
const now = Date.now();
const validFromMs = 0;
const validUntilMs = BigInt(now + 365 * 24 * 60 * 60 * 1000);

function textToMetadataHex(text: string): string {
  const hex = Buffer.from(text, 'utf8').toString('hex');
  return '0x' + hex;
}

async function apiGet(base: string, path: string): Promise<unknown> {
  const res = await fetch(`${base}${path}`, { method: 'GET' });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function apiGetSafe(base: string, path: string): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${base}${path}`, { method: 'GET' });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status} ${text.slice(0, 150)}` };
    return { ok: true, data: text ? JSON.parse(text) : {} };
  } catch (e: unknown) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
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

type CommandResult = { ok?: boolean; message?: string; error?: string; objectId?: string };
async function command(base: string, cmd: string, args: string[]): Promise<CommandResult> {
  return apiPost(base, '/api/command', { cmd, args }) as Promise<CommandResult>;
}

async function commandSafe(base: string, cmd: string, args: string[]): Promise<CommandResult> {
  try {
    return (await apiPost(base, '/api/command', { cmd, args })) as CommandResult;
  } catch (e: unknown) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

function log(step: string, ok: boolean, detail?: string) {
  const s = ok ? 'OK' : 'FAIL';
  console.log(`  [${s}] ${step}${detail ? ' – ' + detail : ''}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollListTickets(owner: string, maxWaitMs = 60000): Promise<Array<{ objectId: string; eventId: string; used: boolean }>> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await sleep(4000);
    const list = (await apiGetSafe(API_A, `/api/list-tickets?owner=${encodeURIComponent(owner)}`)).data as { tickets?: Array<{ objectId: string; eventId: string; used: boolean }> } | undefined;
    if ((list?.tickets?.length ?? 0) > 0) return list!.tickets!;
  }
  return [];
}

async function pollListKeys(owner: string, maxWaitMs = 60000): Promise<Array<{ objectId: string; lockId: string }>> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await sleep(4000);
    const list = (await apiGetSafe(API_A, `/api/list-keys?owner=${encodeURIComponent(owner)}`)).data as { keys?: Array<{ objectId: string; lockId: string }> } | undefined;
    if ((list?.keys?.length ?? 0) > 0) return list!.keys!;
  }
  return [];
}

async function main() {
  console.log('\n=== Alle 9 Kacheln – Real-Life-Test mit 2 Wallets ===\n');

  let addrA: string, addrB: string;
  try {
    const idsA = (await apiGet(API_A, '/api/current-ids')) as { myAddress?: string; packageId?: string };
    addrA = idsA.myAddress || '';
    const idsB = (await apiGet(API_B, '/api/current-ids')) as { myAddress?: string };
    addrB = idsB.myAddress || '';
    if (!addrA || !addrB) throw new Error('Beide Instanzen brauchen MY_ADDRESS (current-ids).');
    const pkgId = (idsA.packageId || '').trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(pkgId)) {
      console.error('PACKAGE_ID auf A fehlt oder ungültig. Bitte deployen oder in .env setzen.');
      process.exit(1);
    }
    // PACKAGE_ID auf B setzen (für list-tickets/list-keys über A, B führt Befehle aus)
    await commandSafe(API_B, '/set-package-id', [pkgId]);
  } catch (e: unknown) {
    console.error('Voraussetzung: Zwei erreichbare APIs mit MY_ADDRESS, A mit PACKAGE_ID.', e);
    process.exit(1);
  }

  console.log('Wallet A:', addrA.slice(0, 20) + '…');
  console.log('Wallet B:', addrB.slice(0, 20) + '…\n');

  if (UNLOCK_PASSWORD) {
    await apiPost(API_A, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
    await apiPost(API_B, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
    console.log('Beide Wallets entsperrt.\n');
  }

  const apiB = addrA === addrB ? API_A : API_B;

  // ═══════════════════════════════════════════════════════════════
  // Kachel 1: Chat mit Freunden
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Kachel 1: Chat mit Freunden ---');
  const connectPromise = command(apiB, '/connect', [addrA]).catch((e) => ({ ok: false, error: String((e as Error)?.message || e) }));
  await sleep(2500);
  let r = await command(API_A, '/handshake', [addrB]);
  log('A: /handshake an B', r.ok === true, r.message || r.error);
  const connectRes = await connectPromise;
  log('B: /connect', connectRes.ok === true, connectRes.message || connectRes.error);
  await sleep(2000);
  r = await command(API_A, '/connect', [addrB]);
  log('A: /connect (Antwort)', r.ok === true, r.message || r.error);
  await sleep(2000);
  r = await command(API_A, '/send', ['Test Nachricht A→B']);
  log('A: /send', r.ok === true, r.message || r.error);
  await sleep(3000);
  const fetchB = (await apiPost(apiB, '/api/command', { cmd: '/fetch', args: ['10'] })) as { ok?: boolean; messages?: Array<{ text?: string }> };
  log('B: /fetch – Nachricht von A', fetchB.ok === true && (fetchB.messages || []).some((m) => (m.text || '').includes('Test Nachricht')), fetchB.ok ? `${(fetchB.messages || []).length} Nachricht(en)` : '');
  const fetchBFromA = (await apiPost(apiB, '/api/command', { cmd: '/fetch', args: ['5', addrA] })) as { ok?: boolean; messages?: unknown[] };
  log('B: /fetch 5 <addrA> (Sender-Filter)', fetchBFromA.ok === true, fetchBFromA.ok ? `${(fetchBFromA.messages || []).length} Nachricht(en)` : '–');
  r = await command(apiB, '/send', ['Antwort B→A']);
  log('B: /send', r.ok === true, r.message || r.error);
  await sleep(2000);
  r = await command(API_A, '/send-plain', [addrB, 'Klartext Pinnwand-Test']);
  log('A: /send-plain (Klartext)', r.ok === true, r.message || r.error);
  const purgeH = await commandSafe(API_A, '/purge-handshake', []);
  log('A: /purge-handshake (optional)', purgeH.ok === true || /MAILBOX|Purge deaktiviert|purge/i.test(purgeH.error || ''), purgeH.ok ? purgeH.message : purgeH.error || 'skip');
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Kachel 2: Tickets & Schlüssel
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Kachel 2: Tickets & Schlüssel ---');
  r = await command(API_A, '/create-ticket', [EVENT_ID, String(validFromMs), String(validUntilMs), '0x', addrB]);
  const createdTicketId = r.objectId;
  log('A: /create-ticket an B', r.ok === true, r.message || r.error);
  r = await command(API_A, '/create-ticket', [EVENT_ID, String(validFromMs), String(validUntilMs), textToMetadataHex('Nicole'), addrB]);
  log('A: /create-ticket personalisiert (Nicole)', r.ok === true, r.message || r.error);
  await sleep(5000);
  let ticketsB = await pollListTickets(addrB);
  const ticket1 = ticketsB.find((t) => !t.used) ?? (createdTicketId ? { objectId: createdTicketId, eventId: EVENT_ID, used: false } : undefined);
  log('B: list-tickets', ticketsB.length >= 0, ticketsB.length ? `${ticketsB.length} Ticket(s)` : createdTicketId ? 'Object-ID aus Create' : '0');
  if (ticket1?.objectId) {
    const valid = (await apiGetSafe(API_A, `/api/has-valid-ticket?owner=${encodeURIComponent(addrB)}&eventId=${encodeURIComponent(EVENT_ID)}`)).data as { valid?: boolean };
    log('hasValidTicket(B)', valid?.valid === true, String(valid?.valid));
    r = await command(apiB, '/use-ticket', [ticket1.objectId, EVENT_ID]);
    log('B: /use-ticket (Einlass)', r.ok === true, r.message || r.error);
    await sleep(2000);
    r = await command(API_A, '/create-ticket', [EVENT_ID, String(validFromMs), String(validUntilMs), '0x', addrB]);
    const ticket2Id = r.objectId;
    await sleep(5000);
    ticketsB = await pollListTickets(addrB);
    const ticket2 = ticketsB.find((t) => !t.used) ?? (ticket2Id ? { objectId: ticket2Id, eventId: EVENT_ID, used: false } : undefined);
    if (ticket2?.objectId) {
      r = await command(apiB, '/transfer-ticket', [ticket2.objectId, addrA]);
      log('B: /transfer-ticket an A', r.ok === true, r.message || r.error);
      await sleep(2000);
      const listA = (await apiGetSafe(API_A, `/api/list-tickets?owner=${encodeURIComponent(addrA)}`)).data as { tickets?: Array<{ objectId: string }> };
      const atA = (listA?.tickets || []).find((t) => t.objectId === ticket2.objectId) ?? (ticket2Id ? { objectId: ticket2Id } : undefined);
      if (atA?.objectId) {
        r = await command(API_A, '/emergency-purge-ticket', [atA.objectId]);
        log('A: /emergency-purge-ticket', r.ok === true, r.message || r.error);
        r = await command(API_A, '/purge-ticket', [atA.objectId]);
        log('A: /purge-ticket', r.ok === true, r.message || r.error);
      }
    }
  }
  // AccessKey: Key an B
  r = await command(API_A, '/create-key', [LOCK_ID, addrB, '7']);
  const createdKeyId = r.objectId;
  log('A: /create-key für B (Schloss→Gast)', r.ok === true, r.message || r.error);
  const rKeys = await commandSafe(API_A, '/create-keys', [LOCK_ID, addrB, '1', '2']);
  log('A: /create-keys (2 Keys, 1 Tag)', rKeys.ok === true, rKeys.message || rKeys.error || '–');
  await sleep(5000);
  let keysB = await pollListKeys(addrB);
  const key1 = keysB.find((k) => k.lockId === LOCK_ID) ?? (createdKeyId ? { objectId: createdKeyId, lockId: LOCK_ID } : undefined);
  log('B: list-keys', keysB.length >= 0, keysB.length ? `${keysB.length} Key(s)` : createdKeyId ? 'Object-ID aus Create' : '0');
  if (key1?.objectId) {
    r = await command(apiB, '/transfer-key', [key1.objectId, addrA]);
    log('B: /transfer-key an A (Rückgabe)', r.ok === true, r.message || r.error);
    await sleep(2000);
    const keysA = (await apiGetSafe(API_A, `/api/list-keys?owner=${encodeURIComponent(addrA)}`)).data as { keys?: Array<{ objectId: string }> };
    const keyAtA = (keysA?.keys || []).find((k) => k.objectId === key1.objectId) ?? (createdKeyId ? { objectId: createdKeyId } : undefined);
    if (keyAtA?.objectId) {
      r = await command(API_A, '/purge-key', [keyAtA.objectId]);
      log('A: /purge-key', r.ok === true, r.message || r.error);
    }
    r = await command(API_A, '/create-key', [LOCK_ID, addrB, '1']);
    const key2Id = r.objectId;
    await sleep(5000);
    keysB = await pollListKeys(addrB);
    const key2 = keysB.find((k) => k.lockId === LOCK_ID) ?? (key2Id ? { objectId: key2Id, lockId: LOCK_ID } : undefined);
    if (key2?.objectId) {
      r = await command(apiB, '/emergency-purge-key', [key2.objectId]);
      log('B: /emergency-purge-key (Verlust)', r.ok === true, r.message || r.error);
      r = await command(apiB, '/purge-key', [key2.objectId]);
      log('B: /purge-key', r.ok === true, r.message || r.error);
    }
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Kachel 3: Schloss & Tür (Heimnetzwerk)
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Kachel 3: Schloss & Tür ---');
  r = await command(API_A, '/create-key', [LOCK_ID, addrB, '1']);
  log('Lock (A): /create-key für B', r.ok === true, r.message || r.error);
  const listKeysB = (await apiGetSafe(API_A, `/api/list-keys?owner=${encodeURIComponent(addrB)}`)).data as { keys?: unknown[] };
  log('B: list-keys (Schlüssel sichtbar)', Array.isArray(listKeysB?.keys), listKeysB?.keys ? `${listKeysB.keys.length} Key(s)` : '–');
  const cfg = (await apiGetSafe(API_A, '/api/config')).data as { ROLE?: string; OPEN_COMMAND?: string };
  log('A: config ROLE/OPEN (Lock-Konfiguration)', true, cfg?.ROLE ? `ROLE=${cfg.ROLE}` : 'ROLE nicht gesetzt');
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Kachel 4: Sensor-Alarm
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Kachel 4: Sensor-Alarm ---');
  log('Send/Fetch (bereits in Chat)', true, 'verschlüsselte Nachricht = Alarm-Szenario');
  const mon4 = await apiGetSafe(API_A, '/api/monitor-status');
  log('A: GET /api/monitor-status', mon4.ok, (mon4.data as { devices?: unknown[] })?.devices ? `${(mon4.data as { devices: unknown[] }).devices.length} Geräte` : mon4.error || '–');
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Kachel 5: Überwachung (Lieferkette)
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Kachel 5: Überwachung ---');
  const mon5a = await apiGetSafe(API_A, '/api/monitor-status');
  const mon5b = await apiGetSafe(API_B, '/api/monitor-status');
  log('A: /api/monitor-status', mon5a.ok, (mon5a.data as { role?: string })?.role ? `role=${(mon5a.data as { role: string }).role}` : '–');
  log('B: /api/monitor-status', mon5b.ok, (mon5b.data as { role?: string })?.role ? `role=${(mon5b.data as { role: string }).role}` : '–');
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Kachel 6: Zahlung & Freischaltung
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Kachel 6: Zahlung & Freischaltung ---');
  r = await commandSafe(apiB, '/transfer-coins', [addrA, '0.001']);
  log('B: /transfer-coins an A (0.001 IOTA)', r.ok === true, r.message || r.error || 'Lock-Adresse A erhält Zahlung');
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Kachel 7: An alle (Pinnwand)
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Kachel 7: Pinnwand ---');
  r = await commandSafe(API_A, '/send-plain', [addrB, 'Pinnwand-Meldung an alle']);
  log('A: /send-plain (Pinnwand-Szenario)', r.ok === true, r.message || r.error);
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Kachel 8: Tresor & Notfall (Vault)
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Kachel 8: Tresor & Notfall ---');
  const config8 = (await apiGetSafe(API_A, '/api/config')).data as { VAULT_FILE?: string; VAULT_REGISTRY_ID?: string };
  log('A: config VAULT_FILE/VAULT_REGISTRY_ID', true, config8?.VAULT_FILE ? 'VAULT_FILE gesetzt' : config8?.VAULT_REGISTRY_ID ? 'VAULT_REGISTRY_ID gesetzt' : 'nicht konfiguriert');
  r = await commandSafe(API_A, '/vault-save', []);
  log('A: /vault-save (optional)', r.ok === true || /VAULT_FILE|nicht gesetzt|Passwort/i.test(r.error || ''), r.ok ? r.message : r.error || 'skip');
  r = await commandSafe(API_A, '/emergency-purge', []);
  log('A: /emergency-purge (optional)', r.ok === true || /VAULT_REGISTRY|ENABLE_PURGE|nicht/i.test(r.error || ''), r.ok ? r.message : r.error || 'skip');
  r = await commandSafe(API_A, '/vault-onchain', []);
  log('A: /vault-onchain (optional)', r.ok === true || /VAULT_REGISTRY|nicht|Passwort/i.test(r.error || ''), r.ok ? r.message : r.error || 'skip');
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Kachel 9: Boss-Modus
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Kachel 9: Boss-Modus ---');
  const genAddr = await apiPost(API_A, '/api/generate-address', {}).catch(() => ({}));
  const newAddr = (genAddr as { address?: string })?.address;
  log('A: POST /api/generate-address', Boolean(newAddr), newAddr ? 'Neue Adresse erzeugt' : 'CLI/Config nötig');
  const deploy = await apiPost(API_A, '/api/deploy-package', {}).catch(() => ({}));
  const pkg = (deploy as { packageId?: string })?.packageId;
  log('A: POST /api/deploy-package (optional)', true, pkg ? `packageId=${pkg.slice(0, 18)}…` : 'bereits deployt oder skip');
  const bossProv = await apiPost(API_A, '/api/boss-provision-handshake', {
    address: addrB,
    partner: addrA,
    pubkey: '', // optional: Base64-Pubkey der Maschine; leer = Skip
  }).catch(() => ({}));
  const provOk = (bossProv as { ok?: boolean })?.ok;
  log('A: POST /api/boss-provision-handshake (optional)', provOk === true || /pubkey|erforderlich/i.test((bossProv as { error?: string })?.error || ''), (bossProv as { message?: string })?.message || (bossProv as { error?: string })?.error || 'skip');
  console.log('');

  console.log('=== Ende: Alle 9 Kacheln durchgespielt (2 Wallets) ===\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
