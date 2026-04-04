/**
 * Real-World-Test: Nachrichten, Streams, Überwachung in einem Durchlauf.
 * Prüft: API erreichbar, /fetch (alte Nachrichten), /inbox, /streams-status, /streams-fetch (mit Timeout),
 * Überwachung (Config, streams-anchor-history, set-heartbeat-interval, device-status).
 *
 * Voraussetzung: Backend läuft (z. B. npm start). Optional: Streams-Bridge für Streams-Tests.
 *   API_BASE=http://127.0.0.1:3342 npm run test:realworld-nachrichten-streams-ueberwachung
 *   BRIDGE_URL=http://127.0.0.1:9343 npm run test:realworld-nachrichten-streams-ueberwachung  # mit Mock-Bridge
 */

const API_BASE = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const BRIDGE_URL = process.env.BRIDGE_URL || '';

const COMMAND_TIMEOUT_MS = 35000;

async function cmd(cmdName: string, args: unknown[]): Promise<{ ok: boolean; message?: string; error?: string; messages?: unknown[]; data?: unknown[]; anchorId?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), COMMAND_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: cmdName, args }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok && (data.ok === true),
      message: data.message,
      error: data.error,
      messages: data.messages,
      data: data.data,
      anchorId: data.anchorId,
    };
  } catch (e: unknown) {
    clearTimeout(t);
    const msg = (e as Error)?.name === 'AbortError' ? 'Zeitüberschreitung' : String((e as Error)?.message || e);
    return { ok: false, error: msg };
  }
}

async function apiGet(path: string, timeoutMs = 10000): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
    clearTimeout(t);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data, error: res.ok ? undefined : (data?.error || res.status + '') };
  } catch (e: unknown) {
    clearTimeout(t);
    return { ok: false, error: (e as Error)?.name === 'AbortError' ? 'Zeitüberschreitung' : String((e as Error)?.message || e) };
  }
}

async function setConfig(key: string, value: string): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const d = await res.json().catch(() => ({}));
    return d.ok === true;
  } catch {
    clearTimeout(t);
    return false;
  }
}

let passed = 0;
let failed = 0;
function ok(name: string, detail?: string) {
  passed++;
  console.log('  [OK] ' + name + (detail ? ' – ' + detail : ''));
}
function fail(name: string, reason: string) {
  failed++;
  console.log('  [FAIL] ' + name + ' – ' + reason);
}

async function main() {
  console.log('\n=== Real-World: Nachrichten, Streams, Überwachung ===\n');
  console.log('API_BASE:', API_BASE);
  console.log('BRIDGE_URL:', BRIDGE_URL || '(nicht gesetzt)\n');

  // --- API erreichbar ---
  console.log('--- 1. API erreichbar ---');
  const statusRes = await apiGet('/api/status');
  if (!statusRes.ok) {
    fail('GET /api/status', statusRes.error || 'nicht erreichbar');
    console.log('\nBackend nicht erreichbar – Abbruch. Bitte starten: npm start\n');
    process.exit(1);
  }
  ok('GET /api/status', 'Backend läuft');

  // --- Nachrichten: /fetch, /inbox ---
  console.log('\n--- 2. Nachrichten (/fetch, /inbox) ---');
  const fetchRes = await cmd('/fetch', ['5']);
  if (fetchRes.ok) {
    const count = (fetchRes.messages ?? fetchRes.data ?? []).length;
    ok('/fetch 5', count + ' Nachricht(en)');
  } else {
    if (fetchRes.error?.includes('Zeitüberschreitung')) fail('/fetch 5', 'Zeitüberschreitung (Backend/Bridge?)');
    else if (fetchRes.error?.includes('PACKAGE_ID') || fetchRes.error?.includes('MY_ADDRESS')) ok('/fetch 5 (erwarteter Fehler)', fetchRes.error?.slice(0, 50));
    else fail('/fetch 5', fetchRes.error || fetchRes.message || 'unbekannt');
  }

  const inboxRes = await cmd('/inbox', ['10']);
  if (inboxRes.ok) {
    const count = (inboxRes.messages ?? inboxRes.data ?? []).length;
    ok('/inbox 10', count + ' Nachricht(en)');
  } else {
    if (inboxRes.error?.includes('Zeitüberschreitung')) fail('/inbox 10', 'Zeitüberschreitung');
    else if (inboxRes.error?.includes('PACKAGE_ID') || inboxRes.error?.includes('Tresor')) ok('/inbox 10 (erwarteter Fehler)', inboxRes.error?.slice(0, 50));
    else fail('/inbox 10', inboxRes.error || inboxRes.message || 'unbekannt');
  }

  // --- Streams ---
  console.log('\n--- 3. Streams ---');
  const streamsStatusRes = await cmd('/streams-status', []);
  if (streamsStatusRes.ok && streamsStatusRes.message) {
    ok('/streams-status', streamsStatusRes.message.includes('gültig') || streamsStatusRes.message.includes('ungültig') ? 'URL-Status angezeigt' : streamsStatusRes.message.slice(0, 40));
  } else {
    fail('/streams-status', streamsStatusRes.error || streamsStatusRes.message || 'keine Antwort');
  }

  const streamsFetchRes = await cmd('/streams-fetch', []);
  if (streamsFetchRes.ok) {
    ok('/streams-fetch', streamsFetchRes.message?.slice(0, 50) || 'OK');
  } else {
    const noBridge = !BRIDGE_URL;
    if (streamsFetchRes.error?.includes('Zeitüberschreitung')) ok('/streams-fetch (Timeout ohne Bridge)', noBridge ? 'erwartet – Bridge nicht gestartet' : 'Bridge nicht erreichbar');
    else if (streamsFetchRes.error?.includes('STREAMS_BRIDGE_URL') || streamsFetchRes.error?.includes('STREAMS_ANCHOR_ID')) ok('/streams-fetch (ohne Bridge/Anchor)', 'erwarteter Hinweis');
    else fail('/streams-fetch', streamsFetchRes.error || streamsFetchRes.message || 'unbekannt');
  }

  // --- Überwachung (Config, Anchor-Historie, Intervall, device-status) ---
  console.log('\n--- 4. Überwachung ---');
  const configRes = await apiGet('/api/config', 8000);
  if (configRes.ok && configRes.data && typeof configRes.data === 'object' && 'config' in (configRes.data as object)) {
    ok('GET /api/config', 'Config geladen');
  } else {
    fail('GET /api/config', configRes.error || 'keine config');
  }

  const anchorHistRes = await apiGet('/api/streams-anchor-history', 5000);
  if (anchorHistRes.ok && anchorHistRes.data && typeof anchorHistRes.data === 'object' && 'history' in (anchorHistRes.data as object)) {
    ok('GET /api/streams-anchor-history', 'current + history');
  } else {
    fail('GET /api/streams-anchor-history', anchorHistRes.error || 'keine history');
  }

  const intervalRes = await cmd('/set-heartbeat-interval', ['60000']);
  if (intervalRes.ok) ok('/set-heartbeat-interval 60000', intervalRes.message?.slice(0, 40) || 'OK');
  else fail('/set-heartbeat-interval', intervalRes.error || intervalRes.message || 'unbekannt');

  const deviceStatusRes = await cmd('/device-status', []);
  if (deviceStatusRes.ok !== false) ok('/device-status', 'antwortet');
  else fail('/device-status', deviceStatusRes.error || deviceStatusRes.message || 'Fehler');

  // --- Optional: Mit Bridge Streams durchspielen ---
  if (BRIDGE_URL) {
    console.log('\n--- 5. Streams mit Bridge ---');
    const setBridge = await setConfig('STREAMS_BRIDGE_URL', BRIDGE_URL);
    if (!setBridge) { fail('STREAMS_BRIDGE_URL setzen', 'setConfig fehlgeschlagen'); } else {
      ok('STREAMS_BRIDGE_URL setzen', BRIDGE_URL);
      const create = await cmd('/streams-create', []);
      if (create.ok && create.anchorId) {
        ok('/streams-create', 'Anchor: ' + create.anchorId.slice(0, 16) + '…');
        const sub = await cmd('/streams-subscribe', [create.anchorId]);
        if (sub.ok) ok('/streams-subscribe', 'OK');
        else fail('/streams-subscribe', sub.error || sub.message || '');
        const fetch2 = await cmd('/streams-fetch', []);
        if (fetch2.ok) ok('/streams-fetch (nach Subscribe)', fetch2.message?.slice(0, 40) || 'OK');
        else fail('/streams-fetch (nach Subscribe)', fetch2.error || fetch2.message || '');
      } else {
        fail('/streams-create', create.error || create.message || '');
      }
    }
  }

  console.log('\n--- Ergebnis ---');
  console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
