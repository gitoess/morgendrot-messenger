/**
 * Firma Real-World: Echte TX auf der Chain – sichtbar im Explorer.
 * Eine ganze „Firma“ durchlaufen: Mitarbeiter-Adressen, Keys, Tickets, Nachrichten
 * untereinander, Vaults erstellen/teilen/nutzen, Rebate – alle Funktionen/Kombinationen.
 * Jede Aktion, die ein Objekt erzeugt, wird mit Explorer-Link geloggt und in eine Datei geschrieben.
 *
 * Voraussetzung: Backend(s) laufen, Wallet entsperrt, RPC auf echte Chain (Testnet/Mainnet).
 * Optional: API_BASE_B für zweites Backend → echte Nachrichten „untereinander“ (A→B, B→A).
 *
 * Env:
 *   API_BASE / API_URL          Boss-API (default http://127.0.0.1:3342)
 *   API_BASE_B                  Optional: zweites Backend für Nachrichten untereinander
 *   FIRMA_KEYS                  Anzahl create-key (default 80)
 *   FIRMA_TICKETS               Anzahl create-ticket (default 50)
 *   FIRMA_MESSAGES              Anzahl send-plain (default 500)
 *   FIRMA_VAULT                 Anzahl vault-save (default 30)
 *   FIRMA_HEARTBEAT             Anzahl heartbeat (default 20)
 *   FIRMA_STREAMS               Anzahl streams-publish nach create (default 20)
 *   FIRMA_LIST_KEYS             Anzahl list-keys (default 100)
 *   FIRMA_LIST_TICKETS          Anzahl list-tickets (default 100)
 *   FIRMA_FETCH                 Anzahl fetch (default 100)
 *   FIRMA_REBATE                Rebate-Checks (default 20)
 *   FIRMA_PURGE_KEYS            Anzahl purge-key für Rebate (default 0; setze z. B. 5 um Rebate zu testen)
 *   FIRMA_PURGE_TICKETS         Anzahl purge-ticket für Rebate (default 0)
 *   FIRMA_DELAY_MS              Basis-Delay zwischen Aktionen (default 150)
 *   FIRMA_CREATE_KEY_DELAY_MS   Delay nach jedem create-key (default 1200) – gibt der Chain Zeit für Gas-Change
 *   FIRMA_CREATE_TICKET_DELAY_MS Delay nach jedem create-ticket (default 1200) – wie oben
 *   FIRMA_SEND_PLAIN_DELAY_MS   Delay nach jedem send-plain (default 1000) – vermeidet Nonce-/Queue-Probleme
 *   EXPLORER_LINKS_FILE         Datei für alle Explorer-Links (default firma-explorer-links.txt)
 *   RESULT_JSON                 JSON mit allen Objekt-IDs und Links (default firma-realworld-result.json)
 *
 * Vault: Damit vault-save im Backend funktioniert, in der .env des Backends VAULT_FILE setzen (z. B. VAULT_FILE=./test-vault.json).
 * Gas: Wenn nur wenige create-key/create-ticket durchgehen (z. B. 3), oft zu wenige Gas-Objekte – Wallet gas-split oder mehr Delay.
 * create-key: Backend nutzt ggf. LOCK_ID aus .env; wenn nicht gesetzt, wird MY_ADDRESS (Boss) als Lock verwendet – bei Fehlern LOCK_ID in Backend .env setzen.
 *
 * Für mehrere tausend Aktionen z. B.:
 *   FIRMA_KEYS=200 FIRMA_TICKETS=150 FIRMA_MESSAGES=1500 FIRMA_VAULT=50 npx tsx scripts/run-firma-realworld-explorer.ts
 *
 * Aufruf:
 *   npm run test:firma-realworld
 *   FIRMA_MESSAGES=1000 FIRMA_KEYS=200 npx tsx scripts/run-firma-realworld-explorer.ts
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_BOSS = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const API_B = (process.env.API_BASE_B || '').replace(/\/$/, '');
const EXPLORER_LINKS_FILE = process.env.EXPLORER_LINKS_FILE || path.join(ROOT, 'firma-explorer-links.txt');
const RESULT_JSON = process.env.RESULT_JSON || path.join(ROOT, 'firma-realworld-result.json');

const COUNTS = {
  keys: Math.min(500, Math.max(10, parseInt(process.env.FIRMA_KEYS || '80', 10) || 80)),
  tickets: Math.min(300, Math.max(10, parseInt(process.env.FIRMA_TICKETS || '50', 10) || 50)),
  messages: Math.min(2000, Math.max(50, parseInt(process.env.FIRMA_MESSAGES || '500', 10) || 500)),
  vault: Math.min(100, Math.max(5, parseInt(process.env.FIRMA_VAULT || '30', 10) || 30)),
  heartbeat: Math.min(50, Math.max(5, parseInt(process.env.FIRMA_HEARTBEAT || '20', 10) || 20)),
  streams: Math.min(100, Math.max(5, parseInt(process.env.FIRMA_STREAMS || '20', 10) || 20)),
  listKeys: Math.min(200, Math.max(10, parseInt(process.env.FIRMA_LIST_KEYS || '100', 10) || 100)),
  listTickets: Math.min(200, Math.max(10, parseInt(process.env.FIRMA_LIST_TICKETS || '100', 10) || 100)),
  fetch: Math.min(200, Math.max(10, parseInt(process.env.FIRMA_FETCH || '100', 10) || 100)),
  rebate: Math.min(50, Math.max(5, parseInt(process.env.FIRMA_REBATE || '20', 10) || 20)),
  purgeKeys: Math.min(50, Math.max(0, parseInt(process.env.FIRMA_PURGE_KEYS || '0', 10) || 0)),
  purgeTickets: Math.min(50, Math.max(0, parseInt(process.env.FIRMA_PURGE_TICKETS || '0', 10) || 0)),
};

const DELAY_MS = Math.max(50, parseInt(process.env.FIRMA_DELAY_MS || '150', 10) || 150);
const DELAY_CREATE_KEY_MS = Math.max(200, parseInt(process.env.FIRMA_CREATE_KEY_DELAY_MS || '1200', 10) || 1200);
const DELAY_CREATE_TICKET_MS = Math.max(200, parseInt(process.env.FIRMA_CREATE_TICKET_DELAY_MS || '1200', 10) || 1200);
const DELAY_SEND_PLAIN_MS = Math.max(200, parseInt(process.env.FIRMA_SEND_PLAIN_DELAY_MS || '1000', 10) || 1000);

type Json = Record<string, unknown>;

const explorerLinks: string[] = [];
const createdKeys: { objectId?: string; explorerLink?: string; lockId: string; recipient: string }[] = [];
const createdTickets: { objectId?: string; explorerLink?: string; eventId: string; recipient: string }[] = [];
const sentMessages: { objectId?: string; explorerLink?: string; to: string; text: string }[] = [];
let okCount = 0;
let failCount = 0;

function addLink(link: string | undefined, kind: string) {
  if (link && !explorerLinks.includes(link)) {
    explorerLinks.push(link);
    try {
      fs.appendFileSync(EXPLORER_LINKS_FILE, link + '\n', 'utf8');
    } catch {}
  }
}

const FETCH_TIMEOUT_MS = 45000;

async function get(base: string, pathSeg: string): Promise<{ status: number; json: Json }> {
  const r = await fetch(base + pathSeg, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { status: r.status, json };
}

async function post(base: string, pathSeg: string, data: unknown): Promise<{ status: number; json: Json }> {
  const r = await fetch(base + pathSeg, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { status: r.status, json };
}

function cmd(base: string, cmdName: string, args: string[] = []): Promise<{ status: number; json: Json }> {
  return post(base, '/api/command', { cmd: cmdName, args });
}

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function ensureBoss(api: string): Promise<boolean> {
  const st = await get(api, '/api/status');
  if ((st.json as Json).locked === true) {
    log('Wallet gesperrt – bitte entsperren.');
    return false;
  }
  const role = (st.json as Json).role as string | undefined;
  if (role === 'boss') return true;
  await post(api, '/api/config', { key: 'ROLE', value: 'boss' });
  await post(api, '/api/config', { key: 'ROLE_ID', value: '14' });
  const st2 = await get(api, '/api/status');
  return (st2.json as Json).role === 'boss';
}

async function main() {
  console.log('\n=== Firma Real-World: Echte TX → Explorer sichtbar ===\n');
  console.log('Boss-API:', API_BOSS);
  if (API_B) console.log('Zweites Backend (Nachrichten untereinander):', API_B);
  console.log('Anzahlen:', COUNTS);
  console.log('Delays (Chain/Nonce/Gas): create-key ' + DELAY_CREATE_KEY_MS + ' ms, create-ticket ' + DELAY_CREATE_TICKET_MS + ' ms, send-plain ' + DELAY_SEND_PLAIN_MS + ' ms');
  console.log('Explorer-Links werden geschrieben in:', EXPLORER_LINKS_FILE);
  if (COUNTS.keys > 5 || COUNTS.tickets > 5) {
    console.log('Hinweis: Viele create-key/create-ticket brauchen ggf. mehrere Gas-Objekte im Wallet (gas-split), sonst nur ~3 TX hintereinander möglich.');
  }
  console.log('');

  try {
    fs.writeFileSync(EXPLORER_LINKS_FILE, '', 'utf8');
  } catch (e) {
    console.error('Konnte Explorer-Links-Datei nicht anlegen:', e);
  }

  const idsRes = await get(API_BOSS, '/api/current-ids');
  const bossAddress = (idsRes.json as Json).myAddress as string | undefined;
  const packageId = (idsRes.json as Json).packageId as string | undefined;
  if (!bossAddress) {
    console.error('MY_ADDRESS nicht gesetzt. Backend unter ' + API_BOSS + ' konfigurieren.');
    process.exit(1);
  }

  const isBoss = await ensureBoss(API_BOSS);
  if (!isBoss) {
    console.error('Backend muss als Boss laufen (ROLE=boss, ROLE_ID=14). Siehe docs/REAL-WORLD-ECHTE-TX-TEST.md');
    process.exit(1);
  }

  const ADDR_REGEX = /^0x[a-fA-F0-9]{64}$/;
  const workerAddresses: string[] = [bossAddress].filter((a) => ADDR_REGEX.test(a));
  log('Generiere Mitarbeiter-Adressen (generate-mnemonic) …');
  const wantWorkers = Math.min(30, Math.max(COUNTS.keys, COUNTS.tickets, COUNTS.messages) / 20);
  for (let i = 0; i < wantWorkers; i++) {
    const gen = await post(API_BOSS, '/api/generate-mnemonic', {});
    const addr = (gen.json as Json).address as string | undefined;
    if (addr && ADDR_REGEX.test(addr) && !workerAddresses.includes(addr)) workerAddresses.push(addr);
    await new Promise((r) => setTimeout(r, 80));
  }
  if (workerAddresses.length === 0) {
    console.error('Keine gültige Boss-Adresse (0x+64 Hex). MY_ADDRESS in Backend prüfen.');
    process.exit(1);
  }
  log('  → ' + workerAddresses.length + ' Adressen (Boss + Mitarbeiter, alle 0x+64 Hex).');

  const totalActions =
    COUNTS.keys +
    COUNTS.tickets +
    COUNTS.messages +
    COUNTS.vault +
    COUNTS.heartbeat +
    COUNTS.streams +
    COUNTS.listKeys +
    COUNTS.listTickets +
    COUNTS.fetch +
    COUNTS.rebate +
    COUNTS.purgeKeys +
    COUNTS.purgeTickets;
  log('Starte ' + totalActions + ' Aktionen (echte TX wo zutreffend) …\n');

  let streamsCreated = false;

  let firstKeyError: string | null = null;
  for (let i = 0; i < COUNTS.keys; i++) {
    const lockId = bossAddress;
    const recipient = workerAddresses[i % workerAddresses.length];
    const ttl = [7, 14, 30][i % 3];
    const res = await cmd(API_BOSS, '/create-key', [lockId, recipient, String(ttl)]);
    if (res.status === 200 && (res.json as Json).ok !== false) {
      okCount++;
      const j = res.json as Json;
      const link = j.explorerLink as string | undefined;
      const oid = j.objectId as string | undefined;
      addLink(link, 'key');
      createdKeys.push({ objectId: oid, explorerLink: link, lockId, recipient });
      if (i < 5 || i % 50 === 0) log('  Key #' + (i + 1) + ' → ' + (link || oid || 'ok'));
    } else {
      failCount++;
      if (!firstKeyError) firstKeyError = String((res.json as Json).message || (res.json as Json).error || res.status);
    }
    if (DELAY_CREATE_KEY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_CREATE_KEY_MS));
  }
  if (firstKeyError) log('  Erster create-key Fehler: ' + firstKeyError.slice(0, 80));
  log('create-key: ' + okCount + ' ok, ' + failCount + ' fail. Explorer-Links: ' + createdKeys.filter((k) => k.explorerLink).length);

  let okT = 0,
    failT = 0;
  const validUntilMs = String(Date.now() + 365 * 24 * 3600 * 1000);
  for (let i = 0; i < COUNTS.tickets; i++) {
    const eventId = '0x' + String(i).padStart(64, '0').slice(-64);
    const recipient = workerAddresses[i % workerAddresses.length];
    const res = await cmd(API_BOSS, '/create-ticket', [eventId, '0', validUntilMs, '0x', recipient]);
    if (res.status === 200 && (res.json as Json).ok !== false) {
      okT++;
      const j = res.json as Json;
      const link = j.explorerLink as string | undefined;
      const oid = j.objectId as string | undefined;
      addLink(link, 'ticket');
      createdTickets.push({ objectId: oid, explorerLink: link, eventId: eventId.slice(0, 16) + '…', recipient: recipient.slice(0, 18) + '…' });
      if (i < 5 || i % 25 === 0) log('  Ticket #' + (i + 1) + ' → ' + (link || oid || 'ok'));
    } else {
      failT++;
      if (failT === 1) log('  Erster create-ticket Fehler: ' + String((res.json as Json).message || (res.json as Json).error || '').slice(0, 80));
    }
    if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  log('create-ticket: ' + okT + ' ok, ' + failT + ' fail.');

  let okM = 0,
    failM = 0;
  let addressB: string | null = null;
  if (API_B) {
    const idsB = await get(API_B, '/api/current-ids');
    addressB = (idsB.json as Json).myAddress as string | undefined || null;
    if (addressB) workerAddresses.push(addressB);
  }
  const apiForMessage = (idx: number) => (API_B && idx % 2 === 1 ? API_B : API_BOSS);
  for (let i = 0; i < COUNTS.messages; i++) {
    const to = workerAddresses[i % workerAddresses.length];
    const text = `Firma #${i + 1} ${new Date().toISOString().slice(0, 19)} – Nachricht untereinander`;
    const base = apiForMessage(i);
    const res = await cmd(base, '/send-plain', [to, text]);
    if (res.status === 200 && (res.json as Json).ok !== false) {
      okM++;
      const j = res.json as Json;
      const link = j.explorerLink as string | undefined;
      const oid = j.objectId as string | undefined;
      addLink(link, 'message');
      sentMessages.push({ objectId: oid, explorerLink: link, to: to.slice(0, 18) + '…', text: text.slice(0, 40) + '…' });
      if (i < 5 || i % 100 === 0) log('  send-plain #' + (i + 1) + ' → ' + (link || oid || 'ok'));
    } else {
      failM++;
    }
    if (DELAY_SEND_PLAIN_MS > 0) await new Promise((r) => setTimeout(r, DELAY_SEND_PLAIN_MS));
  }
  log('send-plain: ' + okM + ' ok, ' + failM + ' fail (Nachrichten untereinander ' + (API_B ? 'A/B' : 'Boss→Mitarbeiter') + ').');

  let okV = 0;
  let vaultSkipped = false;
  for (let i = 0; i < COUNTS.vault; i++) {
    const res = await cmd(API_BOSS, '/vault-save', []);
    if (res.status === 200 && (res.json as Json).ok !== false) {
      okV++;
    } else {
      const msg = String((res.json as Json).message || (res.json as Json).error || '');
      if (/VAULT_FILE|nicht gesetzt/i.test(msg) && !vaultSkipped) {
        log('  (vault-save: VAULT_FILE nicht gesetzt – erwartbar, überspringe Zähler)');
        vaultSkipped = true;
      }
    }
    if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, Math.min(DELAY_MS, 50)));
  }
  log('vault-save: ' + okV + '/' + COUNTS.vault + (vaultSkipped ? ' (VAULT_FILE optional)' : ''));

  if (!streamsCreated && COUNTS.streams > 0) {
    const sc = await cmd(API_BOSS, '/streams-create', []);
    if (sc.status === 200 && (sc.json as Json).ok !== false) streamsCreated = true;
  }
  let okSp = 0;
  for (let i = 0; i < COUNTS.streams; i++) {
    const res = await cmd(API_BOSS, '/streams-publish', [`Firma Streams #${i + 1} ${new Date().toISOString()}`]);
    if (res.status === 200) okSp++;
    if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  log('streams-publish: ' + okSp + '/' + COUNTS.streams);

  let okH = 0;
  for (let i = 0; i < COUNTS.heartbeat; i++) {
    const res = await cmd(API_BOSS, '/heartbeat', []);
    if (res.status === 200) okH++;
    if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  log('heartbeat: ' + okH + '/' + COUNTS.heartbeat);

  for (let i = 0; i < COUNTS.listKeys; i++) {
    await cmd(API_BOSS, '/list-keys', []);
    if (i % 50 === 0 && i > 0) await new Promise((r) => setTimeout(r, 100));
  }
  log('list-keys: ' + COUNTS.listKeys + ' Aufrufe.');

  for (let i = 0; i < COUNTS.listTickets; i++) {
    await cmd(API_BOSS, '/list-tickets', []);
    if (i % 50 === 0 && i > 0) await new Promise((r) => setTimeout(r, 100));
  }
  log('list-tickets: ' + COUNTS.listTickets + ' Aufrufe.');

  for (let i = 0; i < COUNTS.fetch; i++) {
    const n = [5, 10, 20, 50][i % 4];
    await cmd(API_BOSS, '/fetch', [String(n)]);
    if (i % 30 === 0 && i > 0) await new Promise((r) => setTimeout(r, 100));
  }
  log('fetch: ' + COUNTS.fetch + ' Aufrufe.');

  const rebateKeys: string[] = [];
  const rebateTickets: string[] = [];
  for (let i = 0; i < COUNTS.rebate; i++) {
    const q = packageId ? '?packageId=' + encodeURIComponent(packageId) : '';
    const res = await get(API_BOSS, '/api/rebate-candidates' + q);
    if (res.status === 200) {
      const d = res.json as Json;
      const keys = (d.keys as Array<{ objectId?: string }>) || [];
      const tickets = (d.tickets as Array<{ objectId?: string }>) || [];
      keys.forEach((k) => {
        if (k.objectId && !rebateKeys.includes(k.objectId)) rebateKeys.push(k.objectId);
      });
      tickets.forEach((t) => {
        if (t.objectId && !rebateTickets.includes(t.objectId)) rebateTickets.push(t.objectId);
      });
    }
    if (i % 10 === 0 && i > 0) await new Promise((r) => setTimeout(r, 50));
  }
  log('rebate-candidates: ' + rebateKeys.length + ' Keys, ' + rebateTickets.length + ' Tickets (Rebate möglich).');

  if (COUNTS.purgeKeys > 0 && rebateKeys.length > 0) {
    let purged = 0;
    for (let i = 0; i < Math.min(COUNTS.purgeKeys, rebateKeys.length); i++) {
      const res = await cmd(API_BOSS, '/purge-key', [rebateKeys[i]]);
      if (res.status === 200 && (res.json as Json).ok !== false) purged++;
      if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    log('purge-key (Rebate angewandt): ' + purged + ' Keys gelöscht.');
  }
  if (COUNTS.purgeTickets > 0 && rebateTickets.length > 0) {
    let purged = 0;
    for (let i = 0; i < Math.min(COUNTS.purgeTickets, rebateTickets.length); i++) {
      const res = await cmd(API_BOSS, '/purge-ticket', [rebateTickets[i]]);
      if (res.status === 200 && (res.json as Json).ok !== false) purged++;
      if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    log('purge-ticket (Rebate angewandt): ' + purged + ' Tickets gelöscht.');
  }

  const result = {
    timestamp: new Date().toISOString(),
    apiBoss: API_BOSS,
    apiB: API_B || null,
    bossAddress,
    packageId: packageId || null,
    counts: COUNTS,
    totalActions,
    createdKeys: createdKeys.length,
    createdTickets: createdTickets.length,
    sentMessages: sentMessages.length,
    explorerLinksCount: explorerLinks.length,
    explorerLinks,
    createdKeysDetail: createdKeys.slice(0, 100),
    createdTicketsDetail: createdTickets.slice(0, 50),
    sentMessagesDetail: sentMessages.slice(0, 50),
    rebateKeysCount: rebateKeys.length,
    rebateTicketsCount: rebateTickets.length,
  };
  try {
    fs.writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2), 'utf8');
    log('Ergebnis-JSON: ' + RESULT_JSON);
  } catch (e) {
    console.error('Ergebnis-JSON schreiben fehlgeschlagen:', e);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  EXPLORER – alle Objekt-Links (' + explorerLinks.length + ')');
  console.log('  Datei: ' + EXPLORER_LINKS_FILE);
  console.log('═══════════════════════════════════════════════════════════════');
  explorerLinks.slice(0, 30).forEach((u, i) => console.log((i + 1) + '. ' + u));
  if (explorerLinks.length > 30) console.log('  … und ' + (explorerLinks.length - 30) + ' weitere in ' + EXPLORER_LINKS_FILE);
  console.log('═══════════════════════════════════════════════════════════════\n');
  log('Firma Real-World fertig. Keys: ' + createdKeys.length + ', Tickets: ' + createdTickets.length + ', Nachrichten: ' + sentMessages.length + ', Explorer-Links: ' + explorerLinks.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
