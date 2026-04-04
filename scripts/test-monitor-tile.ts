/**
 * Test: Überwachungs-Kachel – alle Kombinationen und Funktionen.
 * - Config: Bridge-URL und Anchor im Klartext (nicht maskiert).
 * - Ungültige Bridge-URL: klare Fehlermeldung (kein "Failed to parse URL from ***").
 * - Schrittreihenfolge: Bridge setzen → Kanal erstellen/abonnieren → Heartbeat.
 *
 * Voraussetzung: Backend läuft (npm run start:secrets). Nach Änderungen an Config/URL-Validierung Backend neu starten.
 * Optional: Streams-Bridge auf BRIDGE_URL für volle Erfolge.
 *
 *   API_BASE=http://127.0.0.1:3342 npx tsx scripts/test-monitor-tile.ts
 *   BRIDGE_URL=http://127.0.0.1:3345 npx tsx scripts/test-monitor-tile.ts  # mit laufender Bridge
 */
const API_BASE = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const BRIDGE_URL = process.env.BRIDGE_URL || ''; // optional: echte Bridge für create/subscribe/heartbeat

async function cmd(cmdName: string, args: unknown[]): Promise<{ ok: boolean; message?: string; error?: string; anchorId?: string }> {
  const res = await fetch(`${API_BASE}/api/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: cmdName, args }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok && (data.ok === true),
    message: data.message,
    error: data.error,
    anchorId: data.anchorId,
  };
}

async function getConfig(): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/api/config`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const list = (res?.config as { envKey?: string; key?: string; value?: string }[]) ?? [];
  const out: Record<string, string> = {};
  for (const item of list) {
    const key = item?.envKey ?? item?.key;
    if (key && item?.value !== undefined) out[key] = String(item.value);
  }
  return out;
}

async function setConfig(key: string, value: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
  const d = await res.json().catch(() => ({}));
  return d.ok === true;
}

function ok(name: string) {
  console.log('  ✓ ' + name);
}
function fail(name: string, reason: string) {
  console.log('  ✗ ' + name + ': ' + reason);
}

async function main() {
  console.log('API_BASE:', API_BASE);
  console.log('BRIDGE_URL:', BRIDGE_URL || '(nicht gesetzt – nur Validierungs-/Fehlermeldungs-Tests)\n');

  let passed = 0;
  let failed = 0;

  // --- Config: Bridge + Anchor im Klartext (nicht maskiert) ---
  console.log('--- Config: Bridge-URL und Anchor unmaskiert ---');
  const cfg = await getConfig();
  const bridgeVal = cfg.STREAMS_BRIDGE_URL ?? '';
  const anchorVal = cfg.STREAMS_ANCHOR_ID ?? '';
  if (bridgeVal && !bridgeVal.includes('…') && !/^\*+\s*$/.test(bridgeVal)) {
    ok('STREAMS_BRIDGE_URL im Klartext (keine Maskierung)');
    passed++;
  } else if (!bridgeVal || bridgeVal === '(leer)') {
    ok('STREAMS_BRIDGE_URL leer oder (leer) – erwartet wenn nie gesetzt');
    passed++;
  } else {
    fail('STREAMS_BRIDGE_URL', 'sollte Klartext sein, ist: ' + bridgeVal.slice(0, 30) + '…');
    failed++;
  }
  if (anchorVal && anchorVal.includes('…')) {
    fail('STREAMS_ANCHOR_ID', 'sollte nicht maskiert sein (kein …)');
    failed++;
  } else if (anchorVal) {
    ok('STREAMS_ANCHOR_ID im Klartext (nicht maskiert)');
    passed++;
  } else {
    ok('STREAMS_ANCHOR_ID leer – OK wenn noch kein Kanal');
    passed++;
  }

  // --- Ungültige URL: klare Fehlermeldung (kein "Failed to parse URL") ---
  console.log('\n--- Ungültige Bridge-URL: klare Fehlermeldung ---');
  await setConfig('STREAMS_BRIDGE_URL', '***');
  const createBad = await cmd('/streams-create', []);
  if (createBad.ok) {
    fail('/streams-create mit ***', 'hätte fehlschlagen sollen');
    failed++;
  } else {
    const msg = (createBad.message || createBad.error || '').toLowerCase();
    if (msg.includes('failed to parse url') || msg.includes('***/streams')) {
      fail('/streams-create mit ***', 'Fehlermeldung sollte gültige URL verlangen, nicht Rohfehler: ' + (createBad.message || createBad.error).slice(0, 80));
      failed++;
    } else {
      ok('Ungültige URL → klare Fehlermeldung (kein "Failed to parse URL")');
      passed++;
    }
  }

  // --- streams-status zeigt (gültig)/(ungültig) ---
  console.log('\n--- streams-status: URL-Validierung angezeigt ---');
  const statusRes = await cmd('/streams-status', []);
  if (statusRes.ok && statusRes.message) {
    if (statusRes.message.includes('ungültig') || statusRes.message.includes('gültig')) {
      ok('streams-status enthält (gültig) oder (ungültig)');
      passed++;
    } else {
      fail('streams-status', 'sollte (gültig)/(ungültig) enthalten');
      failed++;
    }
  } else {
    fail('streams-status', statusRes.error || statusRes.message || 'keine Antwort');
    failed++;
  }

  // --- Heartbeat mit ungültiger URL: klare Meldung ---
  console.log('\n--- Heartbeat mit ungültiger URL ---');
  const hbBad = await cmd('/heartbeat', []);
  if (hbBad.ok && !hbBad.message?.toLowerCase().includes('übersprungen')) {
    fail('/heartbeat', 'mit ***-URL sollte nicht OK sein');
    failed++;
  } else if (!hbBad.ok && (hbBad.message || hbBad.error)?.includes('gültige URL')) {
    ok('Heartbeat mit ungültiger URL → Fehlermeldung verlangt gültige URL');
    passed++;
  } else if (hbBad.message?.toLowerCase().includes('s-bit')) {
    ok('Heartbeat übersprungen (S-Bit) oder anderer erwarteter Hinweis');
    passed++;
  } else {
    ok('Heartbeat-Response: ' + (hbBad.message || hbBad.error || '').slice(0, 60));
    passed++;
  }

  // --- Setze gültige Bridge-URL falls angegeben ---
  if (BRIDGE_URL) {
    console.log('\n--- Mit BRIDGE_URL: Setzen und Kanal erstellen ---');
    await setConfig('STREAMS_BRIDGE_URL', BRIDGE_URL);
    const create = await cmd('/streams-create', []);
    if (create.ok && create.anchorId) {
      ok('Kanal erstellt, Anchor-ID: ' + create.anchorId.slice(0, 20) + '…');
      passed++;
      await setConfig('STREAMS_ANCHOR_ID', create.anchorId);
      const sub = await cmd('/streams-subscribe', [create.anchorId]);
      if (sub.ok) {
        ok('Kanal abonniert');
        passed++;
      } else {
        fail('streams-subscribe', sub.error || sub.message || '');
        failed++;
      }
      const hb = await cmd('/heartbeat', []);
      if (hb.ok || hb.message?.toLowerCase().includes('gesendet')) {
        ok('Heartbeat gesendet oder Hinweis');
        passed++;
      } else {
        fail('/heartbeat', hb.error || hb.message || '');
        failed++;
      }
    } else {
      fail('streams-create', create.error || create.message || 'Bridge nicht erreichbar?');
      failed++;
    }
  }

  // --- Streams-Anchor-Historie API ---
  console.log('\n--- API streams-anchor-history ---');
  try {
    const histRes = await fetch(`${API_BASE}/api/streams-anchor-history`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (histRes && Array.isArray(histRes.history)) {
      ok('streams-anchor-history liefert history (current optional)');
      passed++;
    } else {
      fail('streams-anchor-history', histRes ? 'erwartet history-Array' : 'Request fehlgeschlagen (Backend neu starten?)');
      failed++;
    }
  } catch (e: unknown) {
    fail('streams-anchor-history', String(e));
    failed++;
  }

  // --- set-heartbeat-interval und device-status ---
  console.log('\n--- Intervall und Geräte-Status ---');
  const intervalRes = await cmd('/set-heartbeat-interval', ['60000']);
  if (intervalRes.ok && (intervalRes.message || '').includes('nächsten Takt')) {
    ok('set-heartbeat-interval: Meldung "beim nächsten Takt"');
    passed++;
  } else if (intervalRes.ok) {
    ok('set-heartbeat-interval OK');
    passed++;
  } else {
    fail('set-heartbeat-interval', intervalRes.error || intervalRes.message || '');
    failed++;
  }
  const devStatus = await cmd('/device-status', []);
  if (devStatus.ok !== false) {
    ok('device-status antwortet (OK oder leere Liste)');
    passed++;
  } else {
    fail('device-status', devStatus.error || devStatus.message || '');
    failed++;
  }

  // Restore previous bridge if we had set ***
  if (!BRIDGE_URL && bridgeVal) await setConfig('STREAMS_BRIDGE_URL', bridgeVal);

  console.log('\n--- Ergebnis ---');
  console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
