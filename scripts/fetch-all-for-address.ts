/**
 * Holt für die konfigurierte Adresse (MY_ADDRESS) alle bekannten Package-IDs,
 * lädt für jede die Nachrichten (Fetch) und Rebate-Kandidaten. Nützlich um
 * "alle Nachrichten/Streams/Package-IDs der letzten Tage" zu sammeln.
 *
 * Voraussetzung: Backend läuft, Wallet entsperrt, MY_ADDRESS gesetzt.
 *   API_BASE=http://127.0.0.1:3342 npx tsx scripts/fetch-all-for-address.ts
 */

const API_BASE = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const FETCH_COUNT = 50;

async function get(path: string): Promise<{ status: number; json: unknown }> {
  const r = await fetch(`${API_BASE}${path}`);
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

async function post(path: string, body: object): Promise<{ status: number; json: unknown }> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

type J = Record<string, unknown>;

async function main() {
  console.log('\n=== Alle Daten für Adresse laden (Package-IDs, Nachrichten, Rebate) ===\n');
  console.log('API_BASE:', API_BASE);

  const statusRes = await get('/api/status');
  if (statusRes.status !== 200) {
    console.error('Backend nicht erreichbar. Bitte starten: npm run start:secrets');
    process.exit(1);
  }
  const status = statusRes.json as J;
  if (status.locked) {
    console.error('Wallet ist gesperrt. Bitte zuerst in der UI entsperren oder UNLOCK_PASSWORD setzen.');
    process.exit(1);
  }

  const idsRes = await get('/api/current-ids');
  const ids = idsRes.json as J;
  const myAddress = (ids.myAddress as string) || '';
  if (!myAddress || !myAddress.startsWith('0x')) {
    console.error('MY_ADDRESS nicht gesetzt. Bitte unter Setup/Anfang Adresse setzen.');
    process.exit(1);
  }
  console.log('Adresse:', myAddress.slice(0, 18) + '…\n');

  const histRes = await get('/api/package-id-history?discovered=true&debug=1');
  const hist = histRes.json as J;
  const current = ((hist.current as string) || '').trim();
  const history = (hist.history as string[]) || [];
  const discovered = (hist.discovered as string[]) || [];
  const allPackageIds = [
    ...new Map(
      [current, ...history, ...discovered].filter(Boolean).map((id) => [id.toLowerCase(), id])
    ).values(),
  ];

  console.log('--- Package-IDs (current + history + discovered von Chain) ---');
  console.log('Aktuell:', current || '(leer)');
  console.log('Aus Verlauf:', history.length);
  console.log('Von Chain (discovered):', discovered.length);
  console.log('Gesamt (dedupliziert):', allPackageIds.length);
  const raw = hist.debugOwnedObjects as {
    totalFetched?: number;
    error?: string;
    items?: Array<{
      topLevelKeys?: string[];
      resolvedType?: string;
      extractedPackageId?: string | null;
    }>;
  } | undefined;
  if (raw != null) {
    console.log('  [Debug Chain] Objekte abgerufen:', raw.totalFetched ?? 0, raw.error ? '| Fehler: ' + raw.error : '');
    const items = raw.items ?? [];
    const withPkg = items.filter((i) => i.extractedPackageId);
    if (withPkg.length > 0) console.log('  Davon mit Package-ID:', withPkg.length, '→', [...new Set(withPkg.map((i) => i.extractedPackageId))].filter(Boolean).slice(0, 5));
    else if (items.length > 0) console.log('  Erste Objekt-Keys:', items[0]?.topLevelKeys?.slice(0, 8).join(', ') ?? '');
  }
  if (allPackageIds.length === 0) {
    console.log('\nKeine Package-IDs. Entweder PACKAGE_ID in .env setzen oder Chain-Objekttypen liefern 0x+64hex (z. B. 0xPKG::messaging::AccessKey).');
    process.exit(0);
  }
  for (const id of allPackageIds) {
    console.log('  -', id.slice(0, 18) + '…' + id.slice(-8));
  }

  console.log('\n--- Nachrichten pro Package-ID (/fetch) ---');
  const allMessages: Array<{ packageId: string; messages: unknown[] }> = [];
  for (const pkgId of allPackageIds) {
    const setRes = await post('/api/command', { cmd: '/set-package-id', args: [pkgId] });
    if (!(setRes.json as J).ok) {
      console.log('  Package', pkgId.slice(0, 12) + '…: set-package-id fehlgeschlagen –', (setRes.json as J).error || (setRes.json as J).message);
      continue;
    }
    const fetchRes = await post('/api/command', { cmd: '/fetch', args: [String(FETCH_COUNT)] });
    const data = fetchRes.json as J;
    const messages = (data.messages as unknown[]) || (data.data as unknown[]) || [];
    allMessages.push({ packageId: pkgId, messages });
    console.log('  Package', pkgId.slice(0, 12) + '…:', messages.length, 'Nachricht(en)');
  }

  const totalMessages = allMessages.reduce((s, x) => s + x.messages.length, 0);
  console.log('\nGesamt Nachrichten über alle Packages:', totalMessages);

  console.log('\n--- Rebate-Kandidaten pro Package-ID ---');
  let totalKeys = 0;
  let totalTickets = 0;
  for (const pkgId of allPackageIds) {
    const res = await get(
      '/api/rebate-candidates?packageId=' + encodeURIComponent(pkgId) + '&owner=' + encodeURIComponent(myAddress)
    );
    const data = res.json as J;
    if (!data.ok) {
      console.log('  Package', pkgId.slice(0, 12) + '…: Fehler –', data.error);
      continue;
    }
    const keys = (data.keys as unknown[]) || [];
    const tickets = (data.tickets as unknown[]) || [];
    totalKeys += keys.length;
    totalTickets += tickets.length;
    if (keys.length || tickets.length) {
      console.log('  Package', pkgId.slice(0, 12) + '…:', keys.length, 'Keys,', tickets.length, 'Tickets');
    }
  }
  console.log('Gesamt Rebate-Objekte: Keys', totalKeys, ', Tickets', totalTickets);

  console.log('\n--- Streams Anchor-IDs (Kanäle) ---');
  const anchorRes = await get('/api/streams-anchor-history');
  const anchorData = anchorRes.json as J;
  const anchorCurrent = ((anchorData.current as string) || '').trim();
  const anchorHistory = (anchorData.history as string[]) || [];
  const allAnchors = anchorCurrent ? [anchorCurrent, ...anchorHistory.filter((id) => id !== anchorCurrent)] : anchorHistory;
  console.log('Anzahl Kanäle:', allAnchors.length);
  for (const a of allAnchors) console.log('  -', a.length > 36 ? a.slice(0, 18) + '…' + a.slice(-10) : a);

  console.log('\n--- Streams-Nachrichten (alte Streams zum aktuellen Kanal) ---');
  if (allAnchors.length === 0) {
    console.log('Keine Kanäle. Bridge auf 3443/9343? In der UI unter Streams: STREAMS_BRIDGE_URL (z. B. http://127.0.0.1:3443) setzen, dann „Kanäle aktualisieren“.');
  } else {
    if (!anchorCurrent && allAnchors[0]) {
      await post('/api/config', { key: 'STREAMS_ANCHOR_ID', value: allAnchors[0] });
    }
    const fetchRes = await post('/api/command', { cmd: '/streams-fetch', args: [] });
    const fr = fetchRes.json as J;
    if (fr.ok && Array.isArray(fr.data)) {
      const list = fr.data as Array<{ sender?: string; payload?: string; ts?: number }>;
      console.log('Aktueller Kanal:', list.length, 'Nachricht(en)');
      list.slice(0, 10).forEach((m, i) => {
        console.log('  [' + (i + 1) + ']', (m.sender || 'Kanal').slice(0, 10), (m.payload || '').slice(0, 80));
      });
      if (list.length > 10) console.log('  … und', list.length - 10, 'weitere.');
      if (fr.streamsBridgeUsed) console.log('Hinweis: Bridge antwortete auf', fr.streamsBridgeUsed, '– STREAMS_BRIDGE_URL dort setzen.');
    } else {
      console.log('Fetch:', (fr.message as string) || (fr.error as string) || 'Keine Nachrichten oder Bridge nicht erreichbar.');
      console.log('  UI auf 3342, Bridge oft auf 3443/9343 – Backend probiert diese Ports automatisch.');
    }
  }

  console.log('\n=== Ende ===');
  console.log('In der UI: „IDs & Verlauf“ → Listen aktualisieren, dann Package/Anchor wählen und ggf. „Sofort setzen“.');
  console.log('Nachrichten: Nachrichten → Posteingang → Aktualisieren (nach Package-Wechsel).');
  console.log('Streams: Streams → Nachrichten im Kanal → Kanal wählen → Aktualisieren (Bridge z. B. 3443).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
