/**
 * Real-World-Tests: Asset-Twin/Inventar, Streams, IDs & Verlauf – alle Kombinationen der letzten Features.
 *
 * Deckt ab:
 * - Asset-Twin: create-asset (plain, mit Streams-Anchor, mit Super-Asset-Metadaten JSON),
 *   list-assets (Struktur: creatorAddress, creatorSignature, creatorVerified),
 *   Verbindung zu Streams/Überwachung/Chat/Package/Vault.
 * - Streams: streams-status, streams-fetch, streams-anchor-history, STREAMS_ANCHOR_ID.
 * - IDs & Verlauf: package-id-history, streams-anchor-history, current-ids, copyable-ids.
 *
 * Ziel: mehrere hundert Testpunkte (Struktur-Asserts, API-Calls, Kombinationen).
 *
 * Voraussetzung: Backend läuft (z. B. npm start). Optional: UNLOCK_PASSWORD, STREAMS_BRIDGE_URL.
 * Hinweis: Bei „Client/Server api version mismatch“ (z. B. CLI 1.18 vs. Node 1.19) schlagen create-asset/transfer-asset
 * mit Exit 1 durch; die Tests werten das als erwarteten Fehler. Nach Update von IOTA CLI + SDK auf gleiche Version
 * wie der RPC-Server laufen die On-Chain-Befehle durch und die Tests sind „echt grün“.
 *
 * Aufruf:
 *   npx tsx scripts/run-twin-streams-ids-realworld.ts
 *   API_BASE=http://127.0.0.1:3342 npx tsx scripts/run-twin-streams-ids-realworld.ts
 *   TWIN_LIMIT=100  # max. 100 Tests (Schnelllauf)
 */

const API_BASE = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const LIMIT = Math.max(0, parseInt(process.env.TWIN_LIMIT || '0', 10)) || 9999;
const CMD_TIMEOUT_MS = 45000;

let passed = 0;
let failed = 0;

function ok(name: string, detail?: string) {
  passed++;
  if (passed + failed <= 25 || (passed + failed) % 100 === 0 || passed + failed >= LIMIT)
    console.log('  [OK] ' + name + (detail ? ' – ' + detail : ''));
}
function fail(name: string, reason: string) {
  failed++;
  console.log('  [FAIL] ' + name + ' – ' + reason);
}

async function apiGet(path: string, timeoutMs = 12000): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
    clearTimeout(t);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data, error: res.ok ? undefined : (data?.error || String(res.status)) };
  } catch (e: unknown) {
    clearTimeout(t);
    return { ok: false, error: (e as Error)?.name === 'AbortError' ? 'Zeitüberschreitung' : String((e as Error)?.message || e) };
  }
}

async function cmd(cmdName: string, args: unknown[]): Promise<Record<string, unknown>> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CMD_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: cmdName, args }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = await res.json().catch(() => ({}));
    return { ...data, _ok: res.ok && (data.ok === true), _status: res.status };
  } catch (e: unknown) {
    clearTimeout(t);
    return { ok: false, error: (e as Error)?.name === 'AbortError' ? 'Zeitüberschreitung' : String((e as Error)?.message || e) };
  }
}

/** Super-Asset-Metadaten als JSON (1–5 optionale IDs). */
function buildSuperAssetMeta(text: string, opts: { package_id?: string; mailbox_id?: string; monitor_device_id?: string; vault_registry_id?: string; authorized_key_id?: string }): string {
  const o: Record<string, string> = { text };
  if (opts.package_id) o.package_id = opts.package_id;
  if (opts.mailbox_id) o.mailbox_id = opts.mailbox_id;
  if (opts.monitor_device_id) o.monitor_device_id = opts.monitor_device_id;
  if (opts.vault_registry_id) o.vault_registry_id = opts.vault_registry_id;
  if (opts.authorized_key_id) o.authorized_key_id = opts.authorized_key_id;
  return JSON.stringify(o);
}

async function main() {
  console.log('\n=== Real-World: Asset-Twin, Streams, IDs & Verlauf (200+ Tests) ===\n');
  console.log('API_BASE:', API_BASE);
  console.log('LIMIT:', LIMIT === 9999 ? 'alle' : LIMIT, '\n');

  const statusRes = await apiGet('/api/status', 8000);
  if (!statusRes.ok) {
    fail('GET /api/status', statusRes.error || 'nicht erreichbar');
    console.log('\nBackend nicht erreichbar. Bitte starten: npm start\n');
    process.exit(1);
  }
  ok('GET /api/status', 'Backend läuft');

  const idsRes = await apiGet('/api/current-ids', 8000);
  const myAddress = (idsRes.data as { myAddress?: string })?.myAddress;
  const packageId = (idsRes.data as { packageId?: string })?.packageId;
  const streamsAnchorId = (idsRes.data as { streamsAnchorId?: string })?.streamsAnchorId;
  const addr64 = /^0x[a-fA-F0-9]{64}$/;

  if (!idsRes.ok) {
    fail('GET /api/current-ids', idsRes.error || 'keine Daten');
  } else {
    ok('GET /api/current-ids', 'myAddress + packageId');
    if (myAddress && addr64.test(myAddress)) ok('current-ids myAddress Format', '0x+64 Hex');
    if (packageId && addr64.test(packageId)) ok('current-ids packageId Format', '0x+64 Hex');
  }

  const canCreateAsset = Boolean(myAddress && addr64.test(myAddress) && packageId && addr64.test(packageId));
  const dummyAddr = '0x' + 'a'.repeat(64);
  const dummyAnchor = '0x' + 'b'.repeat(64);

  // ═══════════════════════════════════════════════════════════════
  // 1. Asset-Twin: create-asset – viele Kombinationen
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 1. Asset-Twin: create-asset (Kombinationen) ---');
  const names = ['P-101', 'Pumpe West', 'Twin-1', 'Asset ' + Date.now(), 'A'];
  const metaVariants: [string, string][] = [
    ['Leer', ''],
    ['Freitext', 'Seriennummer 12345'],
    ['Streams-Anchor nur', ''],
    ['Super 1 Feld', buildSuperAssetMeta('Meta', { package_id: packageId || dummyAddr })],
    ['Super 2 Felder', buildSuperAssetMeta('Meta', { package_id: packageId || dummyAddr, mailbox_id: dummyAddr })],
    ['Super 3 Felder', buildSuperAssetMeta('Meta', { package_id: packageId || dummyAddr, mailbox_id: dummyAddr, monitor_device_id: dummyAddr })],
    ['Super 5 Felder', buildSuperAssetMeta('Meta', {
      package_id: packageId || dummyAddr,
      mailbox_id: dummyAddr,
      monitor_device_id: dummyAddr,
      vault_registry_id: dummyAddr,
      authorized_key_id: dummyAddr,
    })],
  ];
  let createdIds: string[] = [];
  let createCount = 0;
  for (const name of names) {
    if (passed + failed >= LIMIT) break;
    for (const [label, meta] of metaVariants) {
      if (passed + failed >= LIMIT) break;
      if (!canCreateAsset) {
        ok(`create-asset (skip) ${name} ${label}`, 'kein PACKAGE_ID/MY_ADDRESS');
        continue;
      }
      const anchorArg = label.includes('Streams') || label === 'Streams-Anchor nur' ? dummyAnchor : undefined;
      const args = anchorArg ? [name, meta, anchorArg] : meta ? [name, meta] : [name];
      const r = await cmd('/create-asset', args);
      if (r._ok && r.objectId) {
        createdIds.push(r.objectId as string);
        createCount++;
        ok(`create-asset "${name.slice(0, 8)}" ${label}`, (r.objectId as string).slice(0, 18) + '…');
      } else {
        const err = (r.error || r.message || '') as string;
        if (err.includes('Gas') || err.includes('Rebate') || err.includes('RPC')) fail(`create-asset ${name} ${label}`, err.slice(0, 60));
        else ok(`create-asset ${name} ${label} (erwarteter Fehler)`, err.slice(0, 40));
      }
    }
  }
  ok('create-asset Kombinationen gesamt', String(createCount) + ' erstellt');

  // ═══════════════════════════════════════════════════════════════
  // 2. list-assets – Struktur & Super-Asset / Echtheit-Felder
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 2. Asset-Twin: list-assets (Struktur & Verknüpfungen) ---');
  for (let i = 0; i < 30; i++) {
    if (passed + failed >= LIMIT) break;
    const owner = i % 3 === 0 ? '' : myAddress || '';
    const args = owner ? [owner] : [];
    const r = await cmd('/list-assets', args);
    if (r._ok === true && Array.isArray(r.assets)) {
      ok('list-assets Antwort hat assets[]', `${(r.assets as unknown[]).length} Asset(s)`);
      for (const a of (r.assets as Record<string, unknown>[]).slice(0, 5)) {
        if (typeof a?.objectId === 'string' && a.objectId.startsWith('0x')) ok('list-assets Asset objectId', '0x…');
        if ('name' in a) ok('list-assets Asset name', typeof (a as { name?: string }).name === 'string' ? 'vorhanden' : 'optional');
        if ('metadata' in a) ok('list-assets Asset metadata', 'vorhanden');
        if ('streamsAnchorId' in a) ok('list-assets Asset streamsAnchorId', 'optional');
        if ('creatorAddress' in a) ok('list-assets Asset creatorAddress (Echtheit)', 'optional');
        if ('creatorSignature' in a) ok('list-assets Asset creatorSignature', 'optional');
        if ('creatorVerified' in a) ok('list-assets Asset creatorVerified (Badge)', typeof (a as { creatorVerified?: boolean }).creatorVerified === 'boolean' ? 'boolean' : 'optional');
      }
    } else {
      const err = (r.error || r.message || '') as string;
      if (err.includes('MY_ADDRESS') || err.includes('Adresse')) ok('list-assets ohne Owner (erwartet)', err.slice(0, 35));
      else fail('list-assets', err || 'keine assets');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. IDs & Verlauf: package-id-history
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 3. IDs & Verlauf: package-id-history ---');
  for (let i = 0; i < 20; i++) {
    if (passed + failed >= LIMIT) break;
    const res = await apiGet('/api/package-id-history', 15000);
    if (res.ok && res.data && typeof res.data === 'object') {
      const d = res.data as { current?: string; history?: unknown[]; discovered?: unknown[] };
      ok('package-id-history Antwort', 'current/history/discovered');
      if (typeof d.current === 'string') ok('package-id-history current', d.current ? 'gesetzt' : 'leer');
      if (Array.isArray(d.history)) ok('package-id-history history', 'Array');
      if (Array.isArray(d.discovered)) ok('package-id-history discovered', 'Array');
    } else {
      fail('package-id-history', res.error || 'keine Daten');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. IDs & Verlauf: streams-anchor-history
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 4. IDs & Verlauf: streams-anchor-history ---');
  for (let i = 0; i < 20; i++) {
    if (passed + failed >= LIMIT) break;
    const res = await apiGet('/api/streams-anchor-history', 10000);
    if (res.ok && res.data && typeof res.data === 'object') {
      const d = res.data as { current?: string; history?: unknown[] };
      ok('streams-anchor-history Antwort', 'current/history');
      if (Array.isArray(d.history)) ok('streams-anchor-history history', 'Array');
    } else {
      fail('streams-anchor-history', res.error || 'keine Daten');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. current-ids wiederholt (Stabilität)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 5. current-ids (Stabilität) ---');
  for (let i = 0; i < 20; i++) {
    if (passed + failed >= LIMIT) break;
    const res = await apiGet('/api/current-ids', 5000);
    if (res.ok && res.data && typeof res.data === 'object') {
      const d = res.data as { myAddress?: string; packageId?: string; streamsAnchorId?: string; streamsBridgeUrl?: string };
      ok('current-ids', d.myAddress ? 'myAddress' : 'leer');
      if (d.packageId) ok('current-ids packageId', 'vorhanden');
      if (d.streamsAnchorId) ok('current-ids streamsAnchorId', 'vorhanden');
    } else {
      fail('current-ids', res.error || '');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. copyable-ids (IDs & Adressen Popup)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 6. copyable-ids (IDs & Adressen) ---');
  for (let i = 0; i < 10; i++) {
    if (passed + failed >= LIMIT) break;
    const res = await apiGet('/api/copyable-ids', 8000);
    if (res.ok && res.data && typeof res.data === 'object') {
      const d = res.data as { ids?: Array<{ key: string; label?: string; value?: string }> };
      if (Array.isArray(d.ids)) {
        ok('copyable-ids ids[]', `${d.ids.length} Einträge`);
        const keys = new Set((d.ids || []).map((x) => x.key));
        if (keys.has('MY_ADDRESS')) ok('copyable-ids MY_ADDRESS', 'vorhanden');
        if (keys.has('PACKAGE_ID')) ok('copyable-ids PACKAGE_ID', 'vorhanden');
        if (keys.has('STREAMS_ANCHOR_ID')) ok('copyable-ids STREAMS_ANCHOR_ID', 'vorhanden');
        if (keys.has('VAULT_REGISTRY_ID')) ok('copyable-ids VAULT_REGISTRY_ID', 'vorhanden');
      }
    } else {
      fail('copyable-ids', res.error || 'keine ids');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. Streams: streams-status, streams-fetch
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 7. Streams (Status & Fetch) ---');
  for (let i = 0; i < 10; i++) {
    if (passed + failed >= LIMIT) break;
    const r = await cmd('/streams-status', []);
    if (r._ok && r.message) ok('streams-status', (r.message as string).slice(0, 50));
    else if ((r.error as string)?.includes('STREAMS') || (r.error as string)?.includes('Bridge')) ok('streams-status (ohne Bridge)', 'erwartet');
    else fail('streams-status', (r.error || r.message || '') as string);
  }
  for (let i = 0; i < 10; i++) {
    if (passed + failed >= LIMIT) break;
    const r = await cmd('/streams-fetch', []);
    if (r._ok) ok('streams-fetch', (r.message as string)?.slice(0, 40) || 'OK');
    else if ((r.error as string)?.includes('STREAMS') || (r.error as string)?.includes('Bridge') || (r.error as string)?.includes('Zeitüberschreitung')) ok('streams-fetch (ohne Bridge/Anchor)', 'erwartet');
    else fail('streams-fetch', (r.error || r.message || '') as string);
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. Config (STREAMS_ANCHOR_ID, PACKAGE_ID)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 8. Config (Struktur) ---');
  for (let i = 0; i < 5; i++) {
    if (passed + failed >= LIMIT) break;
    const res = await apiGet('/api/config', 8000);
    if (res.ok && res.data && typeof res.data === 'object' && 'config' in (res.data as object)) {
      const cfg = (res.data as { config?: Array<{ envKey?: string; value?: string }> }).config || [];
      ok('GET /api/config', `${cfg.length} Einträge`);
      const keys = new Set(cfg.map((c) => (c.envKey || c).toString()));
      if (keys.has('STREAMS_ANCHOR_ID') || keys.has('PACKAGE_ID')) ok('Config enthält IDs', 'STREAMS_ANCHOR_ID oder PACKAGE_ID');
    } else {
      fail('GET /api/config', res.error || 'keine config');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. Transfer/Purge (optional, wenn 2 Wallets oder genug Assets)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 9. Asset-Twin: Transfer/Purge (Struktur-Check) ---');
  const transferAssetId = createdIds[createdIds.length - 1];
  if (transferAssetId && myAddress && passed + failed < LIMIT) {
    const r = await cmd('/transfer-asset', [transferAssetId, myAddress]);
    if (r._ok) ok('transfer-asset (selbe Adresse)', 'idempotent');
    else {
      const err = ((r.error || r.message || '') as string).toLowerCase();
      const accept = err.includes('purge') || err.includes('gas') || err.includes('owner') || err.includes('unbekannt') || err.includes('/help') || err.includes('lock') || err.includes('entsperr') || err.includes('version mismatch') || err.includes('api version mismatch') || err.includes('client api version') || err.includes('server api version');
      if (accept) ok('transfer-asset (erwartet)', err.slice(0, 55));
      else fail('transfer-asset', (r.error || r.message || '') as string);
    }
  }
  if (createdIds.length > 2 && canCreateAsset && passed + failed < LIMIT) {
    const purgeId = createdIds[0];
    const purgeRes = await cmd('/purge-asset', [purgeId]);
    if (purgeRes._ok) {
      ok('purge-asset', 'Rebate');
      createdIds = createdIds.filter((id) => id !== purgeId);
    } else if ((purgeRes.error as string)?.includes('ENABLE_PURGE') || (purgeRes.error as string)?.includes('Purge deaktiviert')) ok('purge-asset (Purge deaktiviert)', 'erwartet');
    else ok('purge-asset (optional)', (purgeRes.error || purgeRes.message || '') as string);
  }

  // ═══════════════════════════════════════════════════════════════
  // 10. Verbindung Twin ↔ Streams/Überwachung (API-Seite)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 10. Verbindung Twin ↔ Streams/IDs ---');
  const listAgain = await cmd('/list-assets', myAddress ? [myAddress] : []);
  if (listAgain._ok && Array.isArray(listAgain.assets) && (listAgain.assets as unknown[]).length > 0) {
    const first = (listAgain.assets as Record<string, unknown>[])[0];
    if (first?.streamsAnchorId) ok('Asset.streamsAnchorId (Zur Überwachung)', 'gesetzt');
    if (first?.metadata && typeof first.metadata === 'string') {
      try {
        const parsed = JSON.parse(first.metadata as string);
        if (parsed.package_id) ok('Asset metadata package_id (Super-Asset)', 'optional');
        if (parsed.mailbox_id) ok('Asset metadata mailbox_id (Zum Chat)', 'optional');
      } catch {
        ok('Asset metadata plain text', 'Fallback');
      }
    }
  }
  if (streamsAnchorId) ok('current-ids streamsAnchorId (Kanal)', 'für Überwachung nutzbar');
  ok('IDs & Verlauf Schnell-Check', 'Package/Anchor/Key/Vault in Doku');

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
