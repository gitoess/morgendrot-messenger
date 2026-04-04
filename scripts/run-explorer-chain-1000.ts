/**
 * 1000 verschiedene Explorer/Chain-Tests – echte TX, sichtbar im Explorer.
 *
 * Szenarien:
 * A) Parallelität (250): 10 Nachrichten gleichzeitig ab (prüft: Backend-Queue, Nonce).
 * B) Sequenz (250): Key erstellen → Ticket erstellen → Key purgen (Rebate) (prüft: Chain-State-Timing).
 * C) Rollen-Wechsel (250): set-role → sofort Aktion, die die neue Rolle erfordert.
 * D) Multi-Backend (250): Boss schickt an B, B antwortet an Boss (Cross-Node-Konsistenz).
 * E) 1000 Objekte für Explorer: 500 create-key + 500 create-ticket (alle an Boss), jeder Link in Datei → alle 1000 im Explorer sichtbar.
 *
 * Voraussetzung: Backend(s) laufen, Wallet entsperrt, RPC echte Chain. Optional: API_BASE_B für D).
 * Env: API_BASE, API_BASE_B (für D), EXPLORER_N_OBJECTS, EXPLORER_OBJECT_DELAY_MS,
 *       EXPLORER_ONLY_OBJECTS (Standard: 1 = nur Phase E, Ende nach 886 Aktionen),
 *       EXPLORER_FULL (1 = danach noch Phasen A/B/C/D), EXPLORER_LINKS_FILE.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let API_BOSS = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const API_B = (process.env.API_BASE_B || '').replace(/\/$/, '');
const EXPLORER_LINKS_FILE = process.env.EXPLORER_LINKS_FILE || path.join(ROOT, 'explorer-chain-1000-links.txt');
const RESULT_JSON = process.env.EXPLORER_CHAIN_1000_RESULT || path.join(ROOT, 'explorer-chain-1000-result.json');
const ADDR_REGEX = /^0x[a-fA-F0-9]{64}$/;
const DELAY_MS = Math.max(200, parseInt(process.env.EXPLORER_DELAY_MS || '400', 10) || 400);
const N_OBJECTS_FOR_EXPLORER = Math.min(2000, Math.max(0, parseInt(process.env.EXPLORER_N_OBJECTS || '1000', 10) || 1000));
const OBJECT_DELAY_MS = Math.max(300, parseInt(process.env.EXPLORER_OBJECT_DELAY_MS || '600', 10) || 600);
/** Standard: nur Phase E (886 Kombinationen), dann Ende. EXPLORER_FULL=1 für zusätzlich Phasen A/B/C/D. */
const ONLY_OBJECTS = process.env.EXPLORER_FULL !== '1' && process.env.EXPLORER_FULL !== 'true';

type Json = Record<string, unknown>;
const explorerLinks: string[] = [];
const results: { scenario: string; testIndex: number; ok: boolean; detail?: string }[] = [];
let passed = 0;
let failed = 0;

function addLink(link: string | undefined) {
  if (link && !explorerLinks.includes(link)) {
    explorerLinks.push(link);
    try {
      fs.appendFileSync(EXPLORER_LINKS_FILE, link + '\n', 'utf8');
    } catch {}
  }
}

async function get(base: string, pathSeg: string): Promise<{ status: number; json: Json }> {
  const r = await fetch(base + pathSeg, { signal: AbortSignal.timeout(30000) });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { status: r.status, json };
}

async function post(base: string, pathSeg: string, data: unknown): Promise<{ status: number; json: Json }> {
  const r = await fetch(base + pathSeg, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(45000),
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

async function findBossApi(): Promise<string> {
  const base = (process.env.API_BASE || process.env.API_URL || '').replace(/\/$/, '');
  if (base) return base;
  for (const port of [3342, 3343, 3344, 3345]) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        console.log('Backend gefunden: Port', port);
        return `http://127.0.0.1:${port}`;
      }
    } catch {}
  }
  console.error('Backend nicht erreichbar (Ports 3342–3345). Bitte starten: npm run start:secrets');
  process.exit(1);
}

async function main() {
  console.log('\n=== 1000 Explorer/Chain-Tests (Parallel, Sequenz, Rollen, Multi-Backend) ===\n');
  API_BOSS = await findBossApi();
  console.log('API_BOSS:', API_BOSS);
  if (ONLY_OBJECTS) console.log('Modus: nur Phase E (886 Kombinationen), danach Ende. Volle Suite: EXPLORER_FULL=1');
  if (API_B) console.log('API_B (Multi-Backend):', API_B);
  try {
    fs.writeFileSync(EXPLORER_LINKS_FILE, '', 'utf8');
  } catch {}

  const idsRes = await get(API_BOSS, '/api/current-ids');
  const bossAddress = (idsRes.json as Json).myAddress as string | undefined;
  if (!bossAddress || !ADDR_REGEX.test(bossAddress)) {
    console.error('MY_ADDRESS fehlt oder ungültig (0x+64 Hex). Backend starten: npm run start:secrets, Wallet entsperren.');
    process.exit(1);
  }

  let addressB: string | null = null;
  if (API_B) {
    const idsB = await get(API_B, '/api/current-ids');
    addressB = (idsB.json as Json).myAddress as string | undefined || null;
    if (!addressB || !ADDR_REGEX.test(addressB)) {
      log('API_B hat keine gültige MY_ADDRESS – Multi-Backend-Tests werden übersprungen.');
    }
  }

  const N_PARALLEL = Math.min(500, Math.max(1, parseInt(process.env.EXPLORER_N_PARALLEL || '250', 10) || 250));
  const N_SEQUENCE = Math.min(500, Math.max(1, parseInt(process.env.EXPLORER_N_SEQUENCE || '250', 10) || 250));
  const N_ROLE = Math.min(500, Math.max(1, parseInt(process.env.EXPLORER_N_ROLE || '250', 10) || 250));
  const N_MULTI = API_B && addressB ? Math.min(500, Math.max(0, parseInt(process.env.EXPLORER_N_MULTI || '250', 10) || 250)) : 0;
  const total = (N_OBJECTS_FOR_EXPLORER > 0 ? 1 : 0) + N_PARALLEL + N_SEQUENCE + N_ROLE + N_MULTI;
  log(`Starte ${total} Phasen. Objekte für Explorer: ${N_OBJECTS_FOR_EXPLORER} (Parallel ${N_PARALLEL}, Sequenz ${N_SEQUENCE}, Rollen ${N_ROLE}, Multi ${N_MULTI})…\n`);

  // --- E) Alle im Code möglichen Kombinationen → Explorer-Links (bis N_OBJECTS_FOR_EXPLORER) ---
  if (N_OBJECTS_FOR_EXPLORER > 0) {
    const validUntilMs = String(Date.now() + 86400000 * 365);
    const validFromPast = String(Date.now() - 3600000);
    type Action = { cmd: string; args: string[]; label: string };
    const actions: Action[] = [];

    // create-key: alle TTL-Varianten (1..90 Tage) – im Code: ttl Tage, beliebig 1..n
    for (const ttl of [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90]) {
      actions.push({ cmd: '/create-key', args: [bossAddress, bossAddress, String(ttl)], label: `create-key ttl=${ttl}` });
    }
    // create-keys: Batch mit count 2,3,5,10,20,50 (alle im Code erlaubt)
    for (const count of [2, 3, 5, 10, 20, 50]) {
      actions.push({ cmd: '/create-keys', args: [bossAddress, bossAddress, '30', String(count)], label: `create-keys count=${count}` });
    }
    // create-key-and-notify: Key + Nachricht in einer TX (TTL + Text-Varianten)
    for (const ttl of [1, 7, 14, 30]) {
      for (const msg of ['Key+Notify A', 'Key+Notify B', 'Zutritt erteilt']) {
        actions.push({ cmd: '/create-key-and-notify', args: [bossAddress, bossAddress, String(ttl), msg], label: `create-key-and-notify ttl=${ttl}` });
      }
    }
    // create-ticket: eventId + validFrom/validUntil + metadataHex (alle Kombinationen)
    const metadataHexVariants = ['0x', '0x00', '0x01', '0xabcd'];
    for (let e = 0; e < 200; e++) {
      const eventId = '0x' + String(100000 + e).padStart(64, '0').slice(-64);
      const meta = metadataHexVariants[e % metadataHexVariants.length];
      actions.push({ cmd: '/create-ticket', args: [eventId, '0', validUntilMs, meta, bossAddress], label: `create-ticket event=${e} meta=${meta}` });
    }
    for (let e = 200; e < 350; e++) {
      const eventId = '0x' + String(100000 + e).padStart(64, '0').slice(-64);
      actions.push({ cmd: '/create-ticket', args: [eventId, validFromPast, validUntilMs, '0x', bossAddress], label: `create-ticket event=${e} validFrom=past` });
    }
    // create-ticket: weitere eventIds (alle gleicher recipient, verschiedene event_id)
    for (let e = 350; e < 850; e++) {
      const eventId = '0x' + String(100000 + e).padStart(64, '0').slice(-64);
      actions.push({ cmd: '/create-ticket', args: [eventId, '0', validUntilMs, '0x', bossAddress], label: `create-ticket event=${e}` });
    }
    // create-tickets: Batch 2,3,5,10,20,50 Tickets pro Aufruf (jeder Aufruf = viele Objekte)
    for (const count of [2, 3, 5, 10, 20, 50]) {
      const eventId = '0x' + String(50000 + count).padStart(64, '0').slice(-64);
      actions.push({ cmd: '/create-tickets', args: [eventId, '0', validUntilMs, '0x', bossAddress, String(count)], label: `create-tickets count=${count}` });
    }

    log(`--- E) Alle Kombinationen (${actions.length} Aktionen, Ziel ≥${N_OBJECTS_FOR_EXPLORER} Links) → Explorer ---`);
    let done = 0;
    for (const { cmd: c, args, label } of actions) {
      const res = await cmd(API_BOSS, c, args);
      if (res.status === 200 && (res.json as Json).ok !== false) {
        const j = res.json as Json;
        const one = j.explorerLink as string | undefined;
        const many = j.explorerLinks as string[] | undefined;
        if (one) addLink(one);
        if (Array.isArray(many)) many.forEach((l) => addLink(l));
      }
      done++;
      if (done <= 10 || done % 50 === 0 || explorerLinks.length >= N_OBJECTS_FOR_EXPLORER) {
        log(`  ${done}/${actions.length} ${label} → ${explorerLinks.length} Links`);
      }
      await new Promise((r) => setTimeout(r, OBJECT_DELAY_MS));
    }
    log(`  → ${explorerLinks.length} Explorer-Links in ${EXPLORER_LINKS_FILE}\n`);
    if (ONLY_OBJECTS) {
      const summary = { timestamp: new Date().toISOString(), explorerLinksCount: explorerLinks.length, combinationsRun: done, explorerLinks, file: EXPLORER_LINKS_FILE };
      try {
        fs.writeFileSync(RESULT_JSON, JSON.stringify(summary, null, 2), 'utf8');
      } catch {}
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  ' + explorerLinks.length + ' Objekte (alle Kombinationen) → ' + EXPLORER_LINKS_FILE);
      console.log('  Öffne die Datei: jede Zeile = ein Explorer-Link.');
      console.log('═══════════════════════════════════════════════════════════════\n');
      process.exit(0);
    }
  }

  // --- A) Parallelität: je 10 Nachrichten gleichzeitig ---
  log('--- A) Parallelität (10 gleichzeitig) ---');
  for (let t = 0; t < N_PARALLEL; t++) {
    const text = `Parallel #${t} ${Date.now()}`;
    const promises = Array.from({ length: 10 }, (_, i) =>
      cmd(API_BOSS, '/send-plain', [bossAddress, `${text} msg-${i}`])
    );
    const settled = await Promise.allSettled(promises);
    const okCount = settled.filter(
      (s) => s.status === 'fulfilled' && s.value.status === 200 && (s.value.json as Json).ok !== false
    ).length;
    const allOk = okCount === 10;
    if (allOk) {
      passed++;
      results.push({ scenario: 'parallel', testIndex: t, ok: true, detail: `10/10 ok` });
    } else {
      failed++;
      results.push({ scenario: 'parallel', testIndex: t, ok: false, detail: `${okCount}/10 ok` });
    }
    if ((t + 1) % 50 === 0) log(`  Parallel ${t + 1}/${N_PARALLEL} (passed=${passed}, failed=${failed})`);
    if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  // --- B) Sequenz: Key → Ticket → Purge Key (Rebate) ---
  log('\n--- B) Sequenz (Key → Ticket → Purge) ---');
  for (let t = 0; t < N_SEQUENCE; t++) {
    const eventId = '0x' + String(10000 + t).padStart(64, '0').slice(-64);
    const validUntilMs = String(Date.now() + 86400000);
    let keyId: string | null = null;
    let seqOk = true;
    const resKey = await cmd(API_BOSS, '/create-key', [bossAddress, bossAddress, '1']);
    if (resKey.status === 200 && (resKey.json as Json).ok !== false) {
      keyId = (resKey.json as Json).objectId as string | undefined || null;
      const link = (resKey.json as Json).explorerLink as string | undefined;
      addLink(link);
    } else {
      seqOk = false;
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
    const resTicket = await cmd(API_BOSS, '/create-ticket', [eventId, '0', validUntilMs, '0x', bossAddress]);
    if (resTicket.status === 200 && (resTicket.json as Json).ok !== false) {
      addLink((resTicket.json as Json).explorerLink as string | undefined);
    } else {
      seqOk = false;
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
    if (keyId && ADDR_REGEX.test(keyId)) {
      const resPurge = await cmd(API_BOSS, '/purge-key', [keyId]);
      if (resPurge.status !== 200 || (resPurge.json as Json).ok === false) seqOk = false;
    }
    if (seqOk) {
      passed++;
      results.push({ scenario: 'sequence', testIndex: t, ok: true });
    } else {
      failed++;
      results.push({ scenario: 'sequence', testIndex: t, ok: false });
    }
    if ((t + 1) % 50 === 0) log(`  Sequenz ${t + 1}/${N_SEQUENCE}`);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  // --- C) Rollen-Wechsel: set-role → Aktion ---
  log('\n--- C) Rollen-Wechsel (set-role → Aktion) ---');
  const roles = ['arbeiter', 'kommandant', 'lock', 'monitor', 'waerter'];
  const actions: { cmd: string; args: string[] }[] = [
    { cmd: '/list-keys', args: [] },
    { cmd: '/list-tickets', args: [] },
    { cmd: '/device-status', args: [] },
    { cmd: '/heartbeat', args: [] },
    { cmd: '/fetch', args: ['5'] },
  ];
  for (let t = 0; t < N_ROLE; t++) {
    const role = roles[t % roles.length];
    const action = actions[t % actions.length];
    await post(API_BOSS, '/api/config', { key: 'ROLE', value: role });
    await post(API_BOSS, '/api/config', { key: 'ROLE_ID', value: String([14, 46, 63, 12, 20][t % 5]) });
    await new Promise((r) => setTimeout(r, 100));
    const res = await cmd(API_BOSS, action.cmd, action.args);
    const ok = res.status === 200 && (res.json as Json).ok !== false;
    if (ok) {
      passed++;
      results.push({ scenario: 'role', testIndex: t, ok: true, detail: `${role} → ${action.cmd}` });
    } else {
      failed++;
      results.push({ scenario: 'role', testIndex: t, ok: false, detail: `${role} → ${action.cmd}` });
    }
    if ((t + 1) % 50 === 0) log(`  Rollen ${t + 1}/${N_ROLE}`);
    await new Promise((r) => setTimeout(r, Math.min(DELAY_MS, 100)));
  }
  await post(API_BOSS, '/api/config', { key: 'ROLE', value: 'boss' });
  await post(API_BOSS, '/api/config', { key: 'ROLE_ID', value: '14' });

  // --- D) Multi-Backend: Boss → B, B → Boss ---
  if (N_MULTI > 0 && addressB) {
    log('\n--- D) Multi-Backend (Boss↔B) ---');
    for (let t = 0; t < N_MULTI; t++) {
      const msgBossToB = `Boss→B #${t} ${Date.now()}`;
      const res1 = await cmd(API_BOSS, '/send-plain', [addressB, msgBossToB]);
      await new Promise((r) => setTimeout(r, DELAY_MS));
      const msgBToBoss = `B→Boss #${t} ${Date.now()}`;
      const res2 = await cmd(API_B, '/send-plain', [bossAddress, msgBToBoss]);
      const ok = res1.status === 200 && (res1.json as Json).ok !== false && res2.status === 200 && (res2.json as Json).ok !== false;
      if (ok) {
        passed++;
        results.push({ scenario: 'multi', testIndex: t, ok: true });
      } else {
        failed++;
        results.push({ scenario: 'multi', testIndex: t, ok: false });
      }
      if ((t + 1) % 50 === 0) log(`  Multi ${t + 1}/${N_MULTI}`);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  const summary = {
    timestamp: new Date().toISOString(),
    total: passed + failed,
    passed,
    failed,
    explorerLinksCount: explorerLinks.length,
    explorerLinks: explorerLinks.slice(0, 200),
    resultsByScenario: {
      parallel: results.filter((r) => r.scenario === 'parallel').filter((r) => r.ok).length,
      sequence: results.filter((r) => r.scenario === 'sequence').filter((r) => r.ok).length,
      role: results.filter((r) => r.scenario === 'role').filter((r) => r.ok).length,
      multi: results.filter((r) => r.scenario === 'multi').filter((r) => r.ok).length,
    },
  };
  try {
    fs.writeFileSync(RESULT_JSON, JSON.stringify(summary, null, 2), 'utf8');
  } catch {}
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Ergebnis: ' + passed + ' bestanden, ' + failed + ' fehlgeschlagen (Gesamt ' + (passed + failed) + ')');
  console.log('  Explorer-Links: ' + explorerLinks.length + ' → ' + EXPLORER_LINKS_FILE);
  console.log('  JSON: ' + RESULT_JSON);
  console.log('═══════════════════════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
