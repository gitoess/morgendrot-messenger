/**
 * Real-World-Test mit ECHTEN TX auf IOTA:
 * Echte Keys/Tickets (NFT), Transfer, Handshake, verschlüsselte + unverschlüsselte Nachrichten,
 * Heartbeat, IOTA Streams (mit Anchor-ID + Link), Rebate.
 * Arbeiter-Adresse optional mit Seed (generate-mnemonic); Kommandant = nur Adresse (ohne zweiten Seed).
 *
 * Gibt am Ende ein vollständiges BEWEIS-RESULTAT aus: alle Adressen, Keys (Object-IDs),
 * Tickets, Explorer-Links, Streams-Anchor, Worker-Secret (mit Sicherheitshinweis) + JSON-Datei.
 *
 * Voraussetzung: Backend läuft, Wallet entsperrt, RPC_URL auf echte Chain (Testnet/Mainnet).
 * Optional: STREAMS_BRIDGE_URL für Streams-Tests.
 *
 * Aufruf: npm run test:echte-tx
 * Env: API_URL (default http://127.0.0.1:3342), RESULT_FILE (default realworld-echte-tx-result.json)
 */

const BASE = process.env.API_URL || 'http://127.0.0.1:3342';
const RESULT_FILE = process.env.RESULT_FILE || 'realworld-echte-tx-result.json';

type Json = Record<string, unknown>;

/** Sammelt alle Beweise für das Ergebnis. */
const proof: {
  timestamp: string;
  apiBase: string;
  addresses: { myAddress: string; workerAddress: string; packageId?: string };
  workerSecretKey?: string;
  createdKeys: { objectId?: string; explorerLink?: string; explorerLinks?: string[] }[];
  createdTickets: { objectId?: string; explorerLink?: string; explorerLinks?: string[] }[];
  transfer: { ok: boolean; digest?: string; error?: string };
  messages: { handshake: boolean; connect: boolean; sendPlain: boolean; sendEncrypted: boolean };
  heartbeat: { ok: boolean; error?: string };
  streams: { anchorId?: string; streamsChannelUrl?: string; publishOk: boolean; fetchOk: boolean };
  rebate: { keysCount: number; ticketsCount: number; keyObjectIds?: string[]; ticketObjectIds?: string[] };
  explorerLinks: string[];
} = {
  timestamp: new Date().toISOString(),
  apiBase: BASE,
  addresses: { myAddress: '', workerAddress: '' },
  createdKeys: [],
  createdTickets: [],
  transfer: { ok: false },
  messages: { handshake: false, connect: false, sendPlain: false, sendEncrypted: false },
  heartbeat: { ok: false },
  streams: { publishOk: false, fetchOk: false },
  rebate: { keysCount: 0, ticketsCount: 0 },
  explorerLinks: [],
};

function addExplorerLinks(json: Json) {
  const one = json.explorerLink as string | undefined;
  const many = json.explorerLinks as string[] | undefined;
  if (one && !proof.explorerLinks.includes(one)) proof.explorerLinks.push(one);
  if (Array.isArray(many)) many.forEach((u) => { if (u && !proof.explorerLinks.includes(u)) proof.explorerLinks.push(u); });
}

async function get(path: string): Promise<{ status: number; json: Json }> {
  const r = await fetch(BASE + path);
  const json = (await r.json().catch(() => ({}))) as Json;
  return { status: r.status, json };
}

async function post(path: string, data: unknown): Promise<{ status: number; json: Json }> {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { status: r.status, json };
}

function cmd(cmdName: string, args: string[] = []): Promise<{ status: number; json: Json }> {
  return post('/api/command', { cmd: cmdName, args });
}

function setConfig(key: string, value: string): Promise<{ status: number; json: Json }> {
  return post('/api/config', { key, value });
}

function log(msg: string) {
  console.log(msg);
}

function logLink(label: string, url: string | undefined) {
  if (url) console.log(`  → ${label}: ${url}`);
}

function logObjectLinks(json: Json) {
  const one = json.explorerLink as string | undefined;
  const many = json.explorerLinks as string[] | undefined;
  if (one) logLink('Explorer (Objekt)', one);
  if (Array.isArray(many)) many.forEach((u, i) => logLink(`Explorer Objekt ${i + 1}`, u));
}

async function run() {
  console.log('=== Real-World: Echte TX auf IOTA ===\n');
  console.log('BASE:', BASE);

  let status: { status: number; json: Json };
  try {
    status = await get('/api/status');
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err?.cause && String((err.cause as Error).message || '').includes('ECONNREFUSED')) {
      console.error('\nBackend läuft nicht. Verbindung zu ' + BASE + ' abgelehnt.');
      console.error('  → In einem anderen Terminal starten:  npm run start:secrets');
      console.error('  → Nach dem Start Wallet entsperren (Browser oder UNLOCK_PASSWORD), dann diesen Befehl erneut ausführen.');
      console.error('  → Anderen Port?  API_URL=http://127.0.0.1:3345 npm run test:echte-tx\n');
    } else {
      console.error(e);
    }
    process.exit(1);
  }
  if (status.status !== 200) {
    console.error('Backend nicht erreichbar (Status ' + status.status + '). Starte npm run start:secrets und entsperre das Wallet.');
    process.exit(1);
  }
  if ((status.json as Json).locked === true) {
    console.error('Wallet ist gesperrt. Entsperre zuerst (UI oder UNLOCK_PASSWORD).');
    process.exit(1);
  }

  const ids = await get('/api/current-ids');
  const myAddress = (ids.json as Json).myAddress as string | undefined;
  const packageId = (ids.json as Json).packageId as string | undefined;
  if (!myAddress) {
    console.error('MY_ADDRESS nicht gesetzt. Bitte .env konfigurieren.');
    process.exit(1);
  }
  proof.addresses.myAddress = myAddress;
  if (packageId) proof.addresses.packageId = packageId;
  log('\nMY_ADDRESS: ' + myAddress);
  if (packageId) log('PACKAGE_ID: ' + packageId);

  await setConfig('ROLE', 'boss');
  await setConfig('ROLE_ID', '14');
  const status2 = await get('/api/status');
  const roleNow = (status2.json as Json).role as string | undefined;
  if (roleNow !== 'boss') {
    console.error('\nBackend ist nicht als Boss (aktuell: ' + (roleNow || '?') + '). Create-Key/Ticket und generate-mnemonic erfordern ROLE=boss.');
    console.error('  Option A – .env anpassen und Backend neu starten:');
    console.error('    ROLE=boss');
    console.error('    ROLE_ID=14');
    console.error('  Option B – Test-Rolle per API erlauben (einmalig):');
    console.error('    In .env eintragen:  ALLOW_TEST_ROLE_OVERRIDE=true');
    console.error('    Backend neu starten:  npm run start:secrets');
    console.error('    Dann erneut:  npm run test:echte-tx   (setzt ROLE=boss und ROLE_ID=14 per API und schreibt sie in .env)\n');
    process.exitCode = 1;
    return;
  }
  log('ROLE: boss (OK)');
  log('ROLE_ID: 14 (S-Bit für Heartbeat)');

  // Arbeiter „mit Seed“: generiere neues Keypair (nur wenn Boss)
  let workerAddr: string;
  let workerSecretKey: string | undefined;
  const gen = await post('/api/generate-mnemonic', {});
  if (gen.status === 200 && (gen.json as Json).address) {
    workerAddr = (gen.json as Json).address as string;
    workerSecretKey = (gen.json as Json).secretKey as string | undefined;
    proof.addresses.workerAddress = workerAddr;
    proof.workerSecretKey = workerSecretKey;
    log('\n--- Arbeiter mit Seed (generate-mnemonic) ---');
    log('Worker-Adresse: ' + workerAddr);
    if (workerSecretKey) log('Worker SecretKey (Beweis – sicher aufbewahren!): ' + workerSecretKey);
    await setConfig('WORKER_ADDRESSES', workerAddr);
  } else {
    workerAddr = myAddress;
    proof.addresses.workerAddress = workerAddr;
    if (gen.status === 403) log('\n--- generate-mnemonic: Nur Boss erlaubt – nutze eigene Adresse als Empfänger ---');
    else log('\n--- Kein zweites Keypair – nutze eigene Adresse als Empfänger ---');
  }

  // Key (NFT) erstellen
  log('\n--- Create Key (echte TX) ---');
  const k = await cmd('/create-key', ['lock1', workerAddr, '30']);
  if (k.status === 200 && (k.json as Json).ok !== false) {
    const j = k.json as Json;
    log('OK create-key');
    logObjectLinks(j);
    proof.createdKeys.push({
      objectId: j.objectId as string | undefined,
      explorerLink: j.explorerLink as string | undefined,
      explorerLinks: j.explorerLinks as string[] | undefined,
    });
    addExplorerLinks(j);
  } else {
    log('create-key: ' + (k.json as Json).error || k.status);
  }

  // Ticket erstellen
  const eventId = '0x' + 'e'.repeat(64);
  const validUntil = String(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);
  log('\n--- Create Ticket (echte TX) ---');
  const t = await cmd('/create-ticket', [eventId, '0', validUntil, workerAddr]);
  if (t.status === 200 && (t.json as Json).ok !== false) {
    const j = t.json as Json;
    log('OK create-ticket');
    logObjectLinks(j);
    const createdIds = j.createdObjectIds as string[] | undefined;
    proof.createdTickets.push({
      objectId: (j.objectId as string) || createdIds?.[0],
      explorerLink: j.explorerLink as string | undefined,
      explorerLinks: j.explorerLinks as string[] | undefined,
    });
    addExplorerLinks(j);
  } else {
    log('create-ticket: ' + (t.json as Json).error || t.status);
  }

  // Transfer
  log('\n--- Transfer Coins (echte TX) ---');
  const tx = await cmd('/transfer-coins', [workerAddr, '0.001']);
  proof.transfer.ok = tx.status === 200 && (tx.json as Json).ok !== false;
  proof.transfer.digest = (tx.json as Json).digest as string | undefined;
  proof.transfer.error = (tx.json as Json).error as string | undefined;
  if (proof.transfer.ok) log('OK transfer-coins 0.001 IOTA');
  else log('transfer-coins: ' + proof.transfer.error || tx.status);

  // Nachrichten
  log('\n--- Nachrichten (echte On-Chain) ---');
  const h = await cmd('/handshake', [workerAddr]);
  proof.messages.handshake = h.status === 200;
  log(proof.messages.handshake ? 'OK handshake' : 'handshake: ' + (h.json as Json).error);
  const c = await cmd('/connect', [workerAddr]);
  proof.messages.connect = c.status === 200;
  log(proof.messages.connect ? 'OK connect' : 'connect: ' + (c.json as Json).error);
  const sp = await cmd('/send-plain', [workerAddr, 'Klartext-Nachricht (echte TX)']);
  proof.messages.sendPlain = sp.status === 200;
  log(proof.messages.sendPlain ? 'OK send-plain (unverschlüsselt)' : 'send-plain: ' + (sp.json as Json).error);
  const se = await cmd('/send', ['Verschluesselte Nachricht (echte TX)']);
  proof.messages.sendEncrypted = se.status === 200;
  log(proof.messages.sendEncrypted ? 'OK send (verschlüsselt)' : 'send: ' + (se.json as Json).error);

  // Heartbeat
  log('\n--- Heartbeat ---');
  const hb = await cmd('/heartbeat', []);
  const hbMsg = ((hb.json as Json).message as string) || ((hb.json as Json).error as string) || '';
  proof.heartbeat.ok = hb.status === 200 && !/verweigert|nicht gesetzt|fehlgeschlagen/i.test(hbMsg);
  proof.heartbeat.error = hbMsg;
  if (proof.heartbeat.ok) log('OK heartbeat');
  else log('heartbeat: ' + (hbMsg || '(z. B. S-Bit / Streams fehlt)'));

  // Streams
  log('\n--- IOTA Streams (echter Kanal) ---');
  const sc = await cmd('/streams-create', []);
  if (sc.status === 200 && (sc.json as Json).ok !== false) {
    const j = sc.json as Json;
    proof.streams.anchorId = j.anchorId as string | undefined;
    proof.streams.streamsChannelUrl = j.streamsChannelUrl as string | undefined;
    log('OK streams-create');
    if (proof.streams.anchorId) log('  → Anchor-ID: ' + proof.streams.anchorId);
    logLink('Streams-Kanal (Bridge)', proof.streams.streamsChannelUrl);
  } else {
    log('streams-create: ' + (sc.json as Json).error || '(STREAMS_BRIDGE_URL setzen)');
  }
  const spub = await cmd('/streams-publish', ['Echte Streams-Nachricht']);
  proof.streams.publishOk = spub.status === 200;
  log(proof.streams.publishOk ? 'OK streams-publish' : 'streams-publish: ' + (spub.json as Json).error);
  const sf = await cmd('/streams-fetch', []);
  proof.streams.fetchOk = sf.status === 200;
  log(proof.streams.fetchOk ? 'OK streams-fetch' : 'streams-fetch: ' + (sf.json as Json).error);

  // Rebate
  log('\n--- Rebate (echte Objekte auf Chain) ---');
  const reb = await get('/api/rebate-candidates' + (packageId ? '?packageId=' + encodeURIComponent(packageId) : ''));
  if (reb.status === 200) {
    const d = reb.json as Json;
    const keys = (d.keys as Array<{ objectId?: string; id?: string }>) ?? [];
    const tickets = (d.tickets as Array<{ objectId?: string; id?: string }>) ?? [];
    proof.rebate.keysCount = keys.length;
    proof.rebate.ticketsCount = tickets.length;
    proof.rebate.keyObjectIds = keys.map((x) => x.objectId || x.id).filter(Boolean) as string[];
    proof.rebate.ticketObjectIds = tickets.map((x) => x.objectId || x.id).filter(Boolean) as string[];
    log('Keys: ' + proof.rebate.keysCount + ', Tickets: ' + proof.rebate.ticketsCount);
  }

  // ---------- BEWEIS / RESULTAT (alle Adressen, Keys, Seed, Links) ----------
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  BEWEIS / RESULTAT – alle Adressen, Keys, Tickets, Links');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Zeitstempel: ' + proof.timestamp);
  console.log('API: ' + proof.apiBase);
  console.log('');
  console.log('--- Adressen ---');
  console.log('MY_ADDRESS (Boss):     ' + proof.addresses.myAddress);
  console.log('WORKER_ADDRESS:       ' + proof.addresses.workerAddress);
  if (proof.addresses.packageId) console.log('PACKAGE_ID:            ' + proof.addresses.packageId);
  if (proof.workerSecretKey) {
    console.log('');
    console.log('--- Worker SecretKey (Seed-Beweis – NICHT teilen, sicher aufbewahren!) ---');
    console.log(proof.workerSecretKey);
  }
  console.log('');
  console.log('--- Erstellte Keys (Object-IDs + Explorer) ---');
  proof.createdKeys.forEach((key, i) => {
    console.log('Key ' + (i + 1) + ' objectId: ' + (key.objectId || '(—)'));
    if (key.explorerLink) console.log('  Explorer: ' + key.explorerLink);
    (key.explorerLinks || []).forEach((u, j) => console.log('  Explorer[' + j + ']: ' + u));
  });
  console.log('');
  console.log('--- Erstellte Tickets (Object-IDs + Explorer) ---');
  proof.createdTickets.forEach((ticket, i) => {
    console.log('Ticket ' + (i + 1) + ' objectId: ' + (ticket.objectId || '(—)'));
    if (ticket.explorerLink) console.log('  Explorer: ' + ticket.explorerLink);
    (ticket.explorerLinks || []).forEach((u, j) => console.log('  Explorer[' + j + ']: ' + u));
  });
  console.log('');
  console.log('--- Transfer ---');
  console.log('OK: ' + proof.transfer.ok + (proof.transfer.digest ? ', digest: ' + proof.transfer.digest : '') + (proof.transfer.error ? ', error: ' + proof.transfer.error : ''));
  console.log('');
  console.log('--- Nachrichten ---');
  console.log('handshake: ' + proof.messages.handshake + ', connect: ' + proof.messages.connect + ', sendPlain: ' + proof.messages.sendPlain + ', sendEncrypted: ' + proof.messages.sendEncrypted);
  console.log('');
  console.log('--- Heartbeat ---');
  console.log('OK: ' + proof.heartbeat.ok + (proof.heartbeat.error ? ', message: ' + proof.heartbeat.error : ''));
  console.log('');
  console.log('--- Streams ---');
  console.log('anchorId: ' + (proof.streams.anchorId || '(—)'));
  console.log('streamsChannelUrl: ' + (proof.streams.streamsChannelUrl || '(—)'));
  console.log('publishOk: ' + proof.streams.publishOk + ', fetchOk: ' + proof.streams.fetchOk);
  console.log('');
  console.log('--- Rebate (Object-IDs auf Chain) ---');
  console.log('Keys count: ' + proof.rebate.keysCount + ', Ticket count: ' + proof.rebate.ticketsCount);
  (proof.rebate.keyObjectIds || []).forEach((id, i) => console.log('  keyObjectId[' + i + ']: ' + id));
  (proof.rebate.ticketObjectIds || []).forEach((id, i) => console.log('  ticketObjectId[' + i + ']: ' + id));
  console.log('');
  console.log('--- Alle Explorer-Links ---');
  proof.explorerLinks.forEach((u, i) => console.log((i + 1) + '. ' + u));
  console.log('═══════════════════════════════════════════════════════════════');

  // JSON-Datei schreiben (vollständiger Beweis)
  const fs = await import('node:fs');
  const path = await import('node:path');
  const outPath = path.resolve(process.cwd(), RESULT_FILE);
  fs.writeFileSync(outPath, JSON.stringify(proof, null, 2), 'utf-8');
  console.log('\nBeweis als JSON gespeichert: ' + outPath);
  console.log('Hinweis: Datei enthält Worker-Secret – nicht committen (z. B. in .gitignore).');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
