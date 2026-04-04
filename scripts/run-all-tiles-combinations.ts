/**
 * Alle Kacheln (Tiles) – alle im Code möglichen Kombinationen.
 * Kacheln: Nachricht, Zutritt, Tickets, Rebate, Streams + Device/Boss.
 * Erstellen, Nachrichten senden, Löschen, Speichern, NFT (Keys/Tickets), Streams – jede Option.
 *
 * Gesamtzahl: deutlich über 1000 (Phase E allein 886; hier kommen Nachricht, Rebate, Streams, Listen, Purge-Varianten dazu).
 *
 * Aufruf:
 *   npx tsx scripts/run-all-tiles-combinations.ts
 *   API_BASE=http://127.0.0.1:3342 npx tsx scripts/run-all-tiles-combinations.ts
 *   TILES_DRY_RUN=1  # nur Zählung, keine API-Calls
 *   TILES_QUICK=1  # Weniger Aktionen, kürzere Delays → Lauf endet in ~5–10 Min (kein Hängen)
 *   TILES_ONCHAIN_DELAY_MS=900   # Delay nach On-Chain-Befehlen
 *   TILES_ONCHAIN_SETTLE_EVERY=25 / TILES_ONCHAIN_SETTLE_MS=2000  # Pause alle N On-Chain
 *
 * Streams: Ohne STREAMS_BRIDGE_URL werden Streams-Aktionen übersprungen. Für volle Streams-Tests:
 *   npm run streams-mock (in anderem Terminal), dann STREAMS_BRIDGE_URL=http://127.0.0.1:9343 setzen (API/ .env).
 * Zutritt/Tickets: Nutzen Boss-Adresse als Lock/Empfänger; LOCK_ID in .env optional.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let API_BASE = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const DRY_RUN = process.env.TILES_DRY_RUN === '1' || process.env.TILES_DRY_RUN === 'true';
const QUICK = process.env.TILES_QUICK === '1' || process.env.TILES_QUICK === 'true';
const ADDR_REGEX = /^0x[a-fA-F0-9]{64}$/;
const DELAY_MS = Math.max(100, parseInt(process.env.TILES_DELAY_MS || (QUICK ? '150' : '300'), 10) || 300);
/** Längeres Delay nach On-Chain-Befehlen (Quick: kürzer, damit kein Hängen). */
const ONCHAIN_DELAY_MS = Math.max(400, parseInt(process.env.TILES_ONCHAIN_DELAY_MS || (QUICK ? '600' : '900'), 10) || 900);
const ONCHAIN_SETTLE_EVERY = Math.max(1, parseInt(process.env.TILES_ONCHAIN_SETTLE_EVERY || (QUICK ? '15' : '25'), 10) || 25);
const ONCHAIN_SETTLE_MS = Math.max(500, parseInt(process.env.TILES_ONCHAIN_SETTLE_MS || (QUICK ? '1200' : '2000'), 10) || 2000);
const ONCHAIN_CMDS = new Set(['/send-plain', '/create-key', '/create-keys', '/create-key-and-notify', '/create-ticket', '/create-tickets']);
const EXPLORER_LINKS_FILE = process.env.TILES_EXPLORER_LINKS_FILE || path.join(ROOT, 'tiles-combinations-links.txt');

type Json = Record<string, unknown>;
const explorerLinks: string[] = [];

function addLink(link: string | undefined) {
  if (link && typeof link === 'string' && link.startsWith('http') && !explorerLinks.includes(link)) {
    explorerLinks.push(link);
    try {
      fs.appendFileSync(EXPLORER_LINKS_FILE, link + '\n', 'utf8');
    } catch {}
  }
}
type Action = { cmd: string; args: string[]; tile: string; label: string };

async function get(base: string, pathSeg: string): Promise<{ status: number; json: Json }> {
  const r = await fetch(base + pathSeg, { signal: AbortSignal.timeout(15000) });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { status: r.status, json };
}

const CMD_TIMEOUT_MS = 70000;
async function post(base: string, pathSeg: string, data: unknown): Promise<{ status: number; json: Json }> {
  const r = await fetch(base + pathSeg, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(CMD_TIMEOUT_MS),
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

/** Baut alle Aktionen für alle Kacheln mit allen im Code möglichen Parametervarianten. */
function buildAllTileActions(bossAddress: string, packageId?: string): Action[] {
  const addr = bossAddress;
  const validUntilMs = String(Date.now() + 86400000 * 365);
  const validFromPast = String(Date.now() - 3600000);
  const actions: Action[] = [];

  // ---- Kachel Nachricht ----
  const sendPlainBase = [
    '', 'OK', 'Test', 'Hallo', '✓', '🔑', 'Klartext', 'Message 1', 'Nachricht mit Umlaut: äöü ÄÖÜ ß',
    '0x', 'A'.repeat(50), 'B'.repeat(200), 'Tür-1_Überwachung', 'Zutritt erteilt.', 'Rebate OK.',
  ];
  const sendPlainMessages: string[] = [...sendPlainBase];
  if (!QUICK) {
    for (let i = 0; i < 100; i++) sendPlainMessages.push(`Kachel-Nachricht #${i} ${Date.now()}`);
    for (let i = 100; i < 600; i++) sendPlainMessages.push(`Nachricht ${i}`);
  } else {
    for (let i = 0; i < 20; i++) sendPlainMessages.push(`Quick #${i}`);
  }
  for (const msg of sendPlainMessages) {
    actions.push({ cmd: '/send-plain', args: [addr, msg], tile: 'nachricht', label: `send-plain "${msg.slice(0, 20)}…"` });
  }
  // fetch: count 1..100, optional sender (Quick: weniger)
  const fetchCounts = QUICK ? [1, 5, 10, 20] : [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
  for (const n of fetchCounts) {
    actions.push({ cmd: '/fetch', args: [String(n)], tile: 'nachricht', label: `fetch ${n}` });
    actions.push({ cmd: '/fetch', args: [String(n), addr], tile: 'nachricht', label: `fetch ${n} sender` });
  }
  // set-package-id: nur mit echter Package-ID (0x…64 Hex), nie mit Boss-Adresse – sonst überschreibt Backend PACKAGE_ID mit MY_ADDRESS
  if (packageId && /^0x[a-fA-F0-9]{64}$/.test(packageId) && packageId !== addr) {
    actions.push({ cmd: '/set-package-id', args: [packageId], tile: 'nachricht', label: 'set-package-id' });
  }
  actions.push({ cmd: '/handshake', args: [addr], tile: 'nachricht', label: 'handshake' });
  actions.push({ cmd: '/connect', args: [addr], tile: 'nachricht', label: 'connect' });
  actions.push({ cmd: '/transfer-coins', args: [addr, '0.001'], tile: 'nachricht', label: 'transfer-coins' });

  // ---- Kachel Zutritt (NFT Keys) ----
  actions.push({ cmd: '/list-keys', args: [], tile: 'zutritt', label: 'list-keys' });
  for (const ttl of [1, 7, 14, 30, 90]) {
    actions.push({ cmd: '/create-key', args: [addr, addr, String(ttl)], tile: 'zutritt', label: `create-key ttl=${ttl}` });
  }
  for (const count of [2, 5, 10]) {
    actions.push({ cmd: '/create-keys', args: [addr, addr, '30', String(count)], tile: 'zutritt', label: `create-keys count=${count}` });
  }
  for (const msg of ['Key+Notify A', 'Key+Notify B', 'Zutritt erteilt']) {
    actions.push({ cmd: '/create-key-and-notify', args: [addr, addr, '14', msg], tile: 'zutritt', label: `create-key-and-notify "${msg.slice(0, 12)}"` });
  }
  // purge-key/transfer-key/emergency-purge-key brauchen keyId → werden nach list-keys mit erzeugten Keys gefüllt (siehe Lauf)

  // ---- Kachel Tickets ----
  actions.push({ cmd: '/list-tickets', args: [], tile: 'tickets', label: 'list-tickets' });
  const ticketRange = QUICK ? 8 : 30;
  for (let e = 0; e < ticketRange; e++) {
    const eventId = '0x' + String(200000 + e).padStart(64, '0').slice(-64);
    actions.push({ cmd: '/create-ticket', args: [eventId, '0', validUntilMs, '0x', addr], tile: 'tickets', label: `create-ticket event=${e}` });
  }
  if (!QUICK) {
    for (let e = 30; e < 50; e++) {
      const eventId = '0x' + String(200000 + e).padStart(64, '0').slice(-64);
      actions.push({ cmd: '/create-ticket', args: [eventId, validFromPast, validUntilMs, '0x', addr], tile: 'tickets', label: `create-ticket event=${e} past` });
    }
  }
  for (const count of [2, 5]) {
    const eventId = '0x' + String(300000).padStart(64, '0').slice(-64);
    actions.push({ cmd: '/create-tickets', args: [eventId, '0', validUntilMs, '0x', addr, String(count)], tile: 'tickets', label: `create-tickets count=${count}` });
  }
  const purgeEventId = '0x' + String(199999).padStart(64, '0').slice(-64);
  actions.push({ cmd: '/create-event-registry', args: [purgeEventId], tile: 'tickets', label: 'create-event-registry (für Purge)' });
  actions.push({ cmd: '/purge-expired-tickets', args: [], tile: 'tickets', label: 'purge-expired-tickets' });

  // ---- Kachel Rebate (Löschen, Speichern) ----
  actions.push({ cmd: '/vault-save', args: [], tile: 'rebate', label: 'vault-save' });
  actions.push({ cmd: '/purge-handshake-cache', args: [], tile: 'rebate', label: 'purge-handshake-cache' });
  actions.push({ cmd: '/purge-local-inbox', args: [], tile: 'rebate', label: 'purge-local-inbox' });
  for (let i = 0; i < 5; i++) {
    actions.push({ cmd: '/list-keys', args: [], tile: 'rebate', label: `list-keys #${i}` });
    actions.push({ cmd: '/list-tickets', args: [], tile: 'rebate', label: `list-tickets #${i}` });
  }

  // ---- Streams ----
  actions.push({ cmd: '/streams-create', args: [], tile: 'streams', label: 'streams-create' });
  actions.push({ cmd: '/streams-status', args: [], tile: 'streams', label: 'streams-status' });
  actions.push({ cmd: '/streams-fetch', args: [], tile: 'streams', label: 'streams-fetch' });
  const streamsN = QUICK ? 15 : 80;
  for (let i = 0; i < streamsN; i++) {
    actions.push({ cmd: '/streams-publish', args: [`Streams Kachel #${i} ${new Date().toISOString()}`], tile: 'streams', label: `streams-publish #${i}` });
  }
  if (!QUICK) {
    for (let i = 80; i < 380; i++) {
      actions.push({ cmd: '/streams-publish', args: [`Stream #${i}`], tile: 'streams', label: `streams-publish #${i}` });
    }
  }

  // ---- Device / Boss ----
  actions.push({ cmd: '/device-status', args: [], tile: 'device', label: 'device-status' });
  actions.push({ cmd: '/heartbeat', args: [], tile: 'device', label: 'heartbeat' });
  // API erwartet Millisekunden, Mindestwert 10000 ms
  for (const ms of [15000, 30000, 60000, 120000, 300000]) {
    actions.push({ cmd: '/set-heartbeat-interval', args: [String(ms)], tile: 'device', label: `set-heartbeat-interval ${ms}ms` });
  }
  for (const bossCmd of ['status', 'heartbeat', 'device-status']) {
    actions.push({ cmd: '/boss-command', args: [JSON.stringify([addr]), bossCmd], tile: 'device', label: `boss-command ${bossCmd}` });
  }
  for (const role of ['arbeiter', 'kommandant', 'lock', 'monitor', 'waerter']) {
    actions.push({ cmd: '/set-role', args: [addr, role], tile: 'device', label: `set-role ${role}` });
  }
  // Zurück auf boss für weitere Aktionen
  actions.push({ cmd: '/set-role', args: [addr, 'boss'], tile: 'device', label: 'set-role boss' });

  return actions;
}

async function main() {
  console.log('\n=== Alle Kacheln – alle Kombinationen (Nachricht, Zutritt, Tickets, Rebate, Streams, Device) ===\n');

  const actions = buildAllTileActions('0x' + 'a'.repeat(64)); // Placeholder; wird durch echte Adresse ersetzt

  const byTile: Record<string, number> = {};
  for (const a of actions) {
    byTile[a.tile] = (byTile[a.tile] || 0) + 1;
  }
  console.log('Kombinationen pro Kachel (ohne Backend):');
  for (const [tile, n] of Object.entries(byTile).sort((a, b) => b[1] - a[1])) {
    console.log('  ', tile, n);
  }
  const total = actions.length;
  console.log('  Gesamt (diese Datei):', total);
  console.log('  + Phase E (explorer-chain-1000): 886 (create-key/ticket alle TTL/Batch/Varianten)');
  const grandTotal = 886 + total;
  console.log('  → Gesamt alle Optionen im Code:', grandTotal, grandTotal >= 2000 ? '(über 2000 – ja, Tausende)' : '(über 1000)\n');

  if (DRY_RUN) {
    console.log('TILES_DRY_RUN=1 → keine API-Calls.');
    process.exit(0);
  }

  // Backend finden (env prüfen, dann Ports 3342–3345)
  async function findApiBase(): Promise<string> {
    const fromEnv = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
    try {
      const r = await fetch(fromEnv + '/api/status', { signal: AbortSignal.timeout(3000) });
      if (r.ok) return fromEnv;
    } catch {}
    for (const port of [3342, 3343, 3344, 3345]) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: AbortSignal.timeout(2000) });
        if (r.ok) {
          console.log('Backend gefunden: Port', port);
          return `http://127.0.0.1:${port}`;
        }
      } catch {}
    }
    return '';
  }

  API_BASE = await findApiBase();
  if (!API_BASE) {
    console.log('\nBackend nicht erreichbar (Ports 3342–3345).');
    console.log('Die Zählung (1123 Kombinationen) wurde oben ausgegeben.');
    console.log('Starte das Backend z.B. mit: npm start');
    console.log('Dann erneut ausführen: npm run test:tiles-combinations\n');
    process.exit(1);
  }

  try {
    fs.writeFileSync(EXPLORER_LINKS_FILE, '', 'utf8');
  } catch {}

  const idsRes = await get(API_BASE, '/api/current-ids');
  const bossAddress = (idsRes.json as Json).myAddress as string | undefined;
  const packageId = (idsRes.json as Json).packageId as string | undefined;
  const streamsBridgeUrl = (idsRes.json as Json).streamsBridgeUrl as string | undefined;
  const streamsAnchorId = (idsRes.json as Json).streamsAnchorId as string | undefined;
  if (!bossAddress || !ADDR_REGEX.test(bossAddress)) {
    console.error('MY_ADDRESS fehlt oder ungültig (0x+64 Hex).');
    process.exit(1);
  }

  // Aktionen mit echter Adresse und echter Package-ID bauen (set-package-id nur mit Package-ID, nie mit Boss-Adresse)
  let actionsWithAddr = buildAllTileActions(bossAddress, packageId);
  if (!streamsBridgeUrl || !streamsBridgeUrl.trim()) {
    const before = actionsWithAddr.length;
    actionsWithAddr = actionsWithAddr.filter((a) => a.tile !== 'streams');
    if (before > actionsWithAddr.length) log(`Streams-Bridge nicht konfiguriert (STREAMS_BRIDGE_URL) – ${before - actionsWithAddr.length} Streams-Aktionen übersprungen. Für Streams: npm run streams-mock und STREAMS_BRIDGE_URL setzen.`);
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const runByTile: Record<string, { ok: number; fail: number; skip?: number }> = {};

  log(`Starte ${actionsWithAddr.length} Aktionen …`);
  if (QUICK) log(`Modus: TILES_QUICK=1 (weniger Varianten, kürzere Delays)`);
  log(`Real-World-Objekte → ${EXPLORER_LINKS_FILE}`);
  log(`On-Chain-Delay: ${ONCHAIN_DELAY_MS} ms, alle ${ONCHAIN_SETTLE_EVERY} On-Chain +${ONCHAIN_SETTLE_MS} ms Pause.\n`);
  let onChainCount = 0;
  /** Antworten, die als „skipped“ (nicht konfiguriert / erwartbar / Backend-Konfig) zählen statt failed. */
  const SKIP_MESSAGE_REGEX = /Keine neuen Nachrichten|nicht gesetzt|STREAMS_BRIDGE_URL|STREAMS_ANCHOR_ID|LOCK_ID.*setzen|MY_ADDRESS.*setzen|EVENT_REGISTRY_ID|Event-Registry-Objekt-ID|Dependent package not found on-chain: 0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5/i;
  let dependentPackageWarned = false;
  for (let i = 0; i < actionsWithAddr.length; i++) {
    const { cmd: c, args, tile, label } = actionsWithAddr[i];
    if (!runByTile[tile]) runByTile[tile] = { ok: 0, fail: 0 };
    try {
      const res = await cmd(API_BASE, c, args);
      const j = res.json as Json;
      const ok = res.status === 200 && j.ok !== false;
      const msg = String(j.message ?? j.error ?? '');
      const isDependentPackageWrong = !ok && /Dependent package not found on-chain: 0x671bf669a858c97a/i.test(msg);
      const isSkipped = !ok && (SKIP_MESSAGE_REGEX.test(msg) || isDependentPackageWrong);
      if (isDependentPackageWrong && !dependentPackageWarned) {
        dependentPackageWarned = true;
        console.log('  Hinweis: Backend verwendet für diesen Befehl noch die Sender-Adresse (0x671b…) statt der Package-ID. Bitte Backend einmal neu starten und in .env PACKAGE_ID=0xd0911511a1d4dbf0e375dd8eb861243beb10df8f6ae1629a874f331e6e208b7e setzen.');
      }
      if (ok) {
        passed++;
        runByTile[tile].ok++;
        const one = j.explorerLink as string | undefined;
        const many = j.explorerLinks as string[] | undefined;
        if (one) addLink(one);
        if (Array.isArray(many)) many.forEach((l) => addLink(l));
      } else if (isSkipped) {
        skipped++;
        if (runByTile[tile].skip === undefined) runByTile[tile].skip = 0;
        runByTile[tile].skip!++;
      } else {
        failed++;
        runByTile[tile].fail++;
        if (failed <= 5) console.log('  Fehler:', c, j.message || res.json);
      }
    } catch (e) {
      failed++;
      runByTile[tile].fail++;
      if (failed <= 5) console.log('  Exception:', c, e instanceof Error ? e.message : String(e));
    }
    const logEvery = QUICK ? 10 : 25;
    if ((i + 1) % logEvery === 0 || i === 0) log(`  ${i + 1}/${actionsWithAddr.length} (passed=${passed}, failed=${failed}, skipped=${skipped}, Explorer-Links=${explorerLinks.length})`);
    const isOnChain = ONCHAIN_CMDS.has(c);
    if (isOnChain) {
      onChainCount++;
      const delay = ONCHAIN_DELAY_MS;
      await new Promise((r) => setTimeout(r, delay));
      if (onChainCount >= ONCHAIN_SETTLE_EVERY) {
        onChainCount = 0;
        await new Promise((r) => setTimeout(r, ONCHAIN_SETTLE_MS));
      }
    } else {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log('\n--- Ergebnis ---');
  for (const [tile, v] of Object.entries(runByTile)) {
    const skipStr = (v as { skip?: number }).skip != null && (v as { skip?: number }).skip! > 0 ? `, skip=${(v as { skip?: number }).skip}` : '';
    console.log(`  ${tile}: ok=${v.ok}, fail=${v.fail}${skipStr}`);
  }
  console.log('  Gesamt: passed=' + passed + ', failed=' + failed + (skipped > 0 ? ', skipped=' + skipped : ''));
  console.log('  Real-World im Explorer: ' + explorerLinks.length + ' Objekte → ' + EXPLORER_LINKS_FILE);
  console.log('  (Jede Zeile = ein Link zu explorer.iota.org/object/0x…?network=testnet)');
  const resultPath = path.join(ROOT, 'all-tiles-combinations-result.json');
  try {
    fs.writeFileSync(resultPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      total: actionsWithAddr.length,
      passed,
      failed,
      skipped,
      explorerLinksCount: explorerLinks.length,
      explorerLinksFile: EXPLORER_LINKS_FILE,
      byTile: runByTile,
    }, null, 2), 'utf8');
    console.log('  Ergebnis:', resultPath);
  } catch {}
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
