/**
 * Batch-Purge: Alle Rebate-Kandidaten (Keys + Tickets) der Boss-Adresse holen und in Batches löschen.
 * Kein Erzeugen neuer Objekte – nur GET /api/rebate-candidates und POST /api/command (/purge-keys, /purge-tickets).
 *
 * Env:
 *   API_BASE / API_URL     Backend (default http://127.0.0.1:3342)
 *   PURGE_BATCH_SIZE       Keys/Tickets pro TX (default 25)
 *   PURGE_MAX_KEYS         Max. Anzahl Keys zu purgen (default: alle)
 *   PURGE_MAX_TICKETS      Max. Anzahl Tickets zu purgen (default: alle)
 *   PURGE_DRY_RUN=1        Nur anzeigen, keine API-Purge-Calls
 *   EXPLORER_BASE_URL      Basis-URL des Explorers (default https://explorer.iota.org)
 *   EXPLORER_NETWORK       network= (default testnet) für txblock-Link
 *
 * Nach Purge: Die Objekte (Keys/Tickets) existieren nicht mehr → im Explorer unter „Object“ nicht sichtbar (erwartet). Die Purge-Transaktion siehst du unter txblock/<digest>.
 *
 * Aufruf:
 *   npx tsx scripts/purge-rebate-batch.ts
 *   PURGE_DRY_RUN=1 npx tsx scripts/purge-rebate-batch.ts
 */

import 'dotenv/config';

const API_BASE = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const BATCH_SIZE = Math.max(1, Math.min(50, parseInt(process.env.PURGE_BATCH_SIZE || '25', 10) || 25));
const MAX_KEYS = process.env.PURGE_MAX_KEYS ? Math.max(0, parseInt(process.env.PURGE_MAX_KEYS, 10) || 0) : undefined;
const MAX_TICKETS = process.env.PURGE_MAX_TICKETS ? Math.max(0, parseInt(process.env.PURGE_MAX_TICKETS, 10) || 0) : undefined;
const DRY_RUN = process.env.PURGE_DRY_RUN === '1' || process.env.PURGE_DRY_RUN === 'true';
const EXPLORER_TX = (process.env.EXPLORER_BASE_URL || 'https://explorer.iota.org').replace(/\/$/, '');
const NETWORK = process.env.EXPLORER_NETWORK || 'testnet';

type Json = Record<string, unknown>;

function txExplorerLink(digest: string | undefined): string {
  if (!digest) return '';
  const base = EXPLORER_TX.includes('explorer.iota.org') ? EXPLORER_TX + '/txblock/' + digest : EXPLORER_TX;
  return NETWORK ? base + '?network=' + NETWORK : base;
}

async function get(path: string): Promise<{ status: number; json: Json }> {
  const r = await fetch(API_BASE + path, { signal: AbortSignal.timeout(30000) });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { status: r.status, json };
}

async function post(path: string, data: unknown): Promise<{ status: number; json: Json }> {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(60000),
  });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { status: r.status, json };
}

function cmd(cmdName: string, args: string[]): Promise<{ status: number; json: Json }> {
  return post('/api/command', { cmd: cmdName, args });
}

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log('\n=== Batch-Purge (Rebate): Keys + Tickets ===\n');
  console.log('API:', API_BASE);
  console.log('Batch-Größe:', BATCH_SIZE);
  if (MAX_KEYS != null) console.log('Max. Keys:', MAX_KEYS);
  if (MAX_TICKETS != null) console.log('Max. Tickets:', MAX_TICKETS);
  if (DRY_RUN) console.log('Modus: DRY_RUN – keine Purge-Calls.\n');
  else console.log('');

  const statusRes = await get('/api/status');
  if (statusRes.json.locked === true) {
    console.error('Wallet ist gesperrt. Bitte zuerst entsperren (POST /api/unlock).');
    process.exit(1);
  }

  const idsRes = await get('/api/current-ids');
  const owner = (idsRes.json as Json).myAddress as string | undefined;
  const packageId = (idsRes.json as Json).packageId as string | undefined;
  if (!owner) {
    console.error('MY_ADDRESS nicht gesetzt.');
    process.exit(1);
  }

  const q = packageId ? '?owner=' + encodeURIComponent(owner) + '&packageId=' + encodeURIComponent(packageId) : '?owner=' + encodeURIComponent(owner);
  const res = await get('/api/rebate-candidates' + q);
  if (res.status !== 200 || (res.json as Json).ok !== true) {
    console.error('rebate-candidates fehlgeschlagen:', res.status, (res.json as Json).error || res.json);
    process.exit(1);
  }

  const keys = ((res.json as Json).keys as Array<{ objectId?: string }>) || [];
  const tickets = ((res.json as Json).tickets as Array<{ objectId?: string }>) || [];
  const keyIds = keys.map((k) => k.objectId).filter((id): id is string => Boolean(id && /^0x[0-9a-fA-F]+$/.test(id)));
  const ticketIds = tickets.map((t) => t.objectId).filter((id): id is string => Boolean(id && /^0x[0-9a-fA-F]+$/.test(id)));

  const keysToPurge = MAX_KEYS != null ? keyIds.slice(0, MAX_KEYS) : keyIds;
  const ticketsToPurge = MAX_TICKETS != null ? ticketIds.slice(0, MAX_TICKETS) : ticketIds;

  log('Rebate-Kandidaten: ' + keyIds.length + ' Keys, ' + ticketIds.length + ' Tickets.');
  log('Zu purgen: ' + keysToPurge.length + ' Keys, ' + ticketsToPurge.length + ' Tickets.');

  if (keysToPurge.length === 0 && ticketsToPurge.length === 0) {
    log('Nichts zu tun.');
    process.exit(0);
  }

  if (DRY_RUN) {
    log('DRY_RUN: Würde ' + keysToPurge.length + ' Keys und ' + ticketsToPurge.length + ' Tickets purgen.');
    process.exit(0);
  }

  let purgedKeys = 0;
  let purgedTickets = 0;

  const keyBatches = chunk(keysToPurge, BATCH_SIZE);
  for (let i = 0; i < keyBatches.length; i++) {
    const ids = keyBatches[i];
    if (ids.length === 1) {
      const r = await cmd('/purge-key', [ids[0]]);
      if (r.status === 200 && (r.json as Json).ok !== false) {
        purgedKeys += 1;
        const d = (r.json as Json).digest as string | undefined;
        if (d) log('  TX: ' + txExplorerLink(d));
      } else log('purge-key Fehler: ' + JSON.stringify((r.json as Json).message || r.json));
    } else {
      const r = await cmd('/purge-keys', ids);
      if (r.status === 200 && (r.json as Json).ok !== false) {
        purgedKeys += ids.length;
        const d = (r.json as Json).digest as string | undefined;
        if (d) log('  TX: ' + txExplorerLink(d));
      } else log('purge-keys Fehler: ' + JSON.stringify((r.json as Json).message || r.json));
    }
    log('Keys: ' + purgedKeys + ' / ' + keysToPurge.length);
    if (i < keyBatches.length - 1) await new Promise((r) => setTimeout(r, 400));
  }

  const ticketBatches = chunk(ticketsToPurge, BATCH_SIZE);
  for (let i = 0; i < ticketBatches.length; i++) {
    const ids = ticketBatches[i];
    if (ids.length === 1) {
      const r = await cmd('/purge-ticket', [ids[0]]);
      if (r.status === 200 && (r.json as Json).ok !== false) {
        purgedTickets += 1;
        const d = (r.json as Json).digest as string | undefined;
        if (d) log('  TX: ' + txExplorerLink(d));
      } else log('purge-ticket Fehler: ' + JSON.stringify((r.json as Json).message || r.json));
    } else {
      const r = await cmd('/purge-tickets', ids);
      if (r.status === 200 && (r.json as Json).ok !== false) {
        purgedTickets += ids.length;
        const d = (r.json as Json).digest as string | undefined;
        if (d) log('  TX: ' + txExplorerLink(d));
      } else log('purge-tickets Fehler: ' + JSON.stringify((r.json as Json).message || r.json));
    }
    log('Tickets: ' + purgedTickets + ' / ' + ticketsToPurge.length);
    if (i < ticketBatches.length - 1) await new Promise((r) => setTimeout(r, 400));
  }

  log('Fertig. Gepurged: ' + purgedKeys + ' Keys, ' + purgedTickets + ' Tickets (Storage Rebate fließt zurück).');
  log('Hinweis: Gepurgte Objekte erscheinen im Explorer unter „Object“ nicht mehr (gelöscht). Die Purge-Transaktionen siehst du unter „Transaction“ / txblock/<digest>.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
