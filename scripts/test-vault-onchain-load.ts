/**
 * Test: Vault von der Chain laden (/vault-load-from-chain).
 * Voraussetzung: Backend läuft, VAULT_REGISTRY_ID + PACKAGE_ID gesetzt,
 * mindestens einmal „On-Chain speichern“ ausgeführt.
 *
 *   API_BASE=http://127.0.0.1:3342 VAULT_PASSWORD=123 npx tsx scripts/test-vault-onchain-load.ts
 */

const API_BASE = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const PASSWORD = process.env.VAULT_PASSWORD || '123';

async function main() {
  console.log('API_BASE:', API_BASE);
  console.log('Passwort:', PASSWORD ? '***' : '(leer)');

  const status = await fetch(`${API_BASE}/api/status`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!status) {
    console.error('Backend nicht erreichbar. Bitte starten: npm run start:secrets');
    process.exit(1);
  }
  console.log('Status: hasKeys=', status.hasKeys, 'myAddress=', status.myAddress ? status.myAddress.slice(0, 18) + '…' : '-');

  try {
    await fetch(`${API_BASE}/api/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
  } catch {
    // ignore
  }

  const debugRes = await fetch(`${API_BASE}/api/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: '/vault-debug-chain', args: [] }),
  });
  const debugData = debugRes.ok ? await debugRes.json() : null;
  if (debugData?.debug) {
    const d = debugData.debug;
    const errStr = d.error != null ? (typeof d.error === 'object' ? JSON.stringify(d.error) : String(d.error)) : '';
    if (errStr && errStr === '[object Object]') {
      console.log('Vault-Debug (vollständige Antwort):', JSON.stringify(d, null, 2));
    }
    console.log('Vault-Debug:', d.found ? 'gefunden' : 'nicht gefunden', errStr && errStr !== '[object Object]' ? `Error: ${errStr}` : '');
    console.log('  dataKeys:', (d.dataKeys && d.dataKeys.length) ? d.dataKeys.join(', ') : '(leer)');
    console.log('  valueKeys:', (d.valueKeys && d.valueKeys.length) ? d.valueKeys.join(', ') : '(leer)');
    console.log('  contentKeys:', (d.contentKeys && d.contentKeys.length) ? d.contentKeys.join(', ') : '(leer)');
    console.log('  fields:', (d.keys && d.keys.length) ? d.keys.join(', ') : '(leer)');
  } else if (debugData?.message) {
    console.log('Vault-Debug:', debugData.message);
  }

  const res = await fetch(`${API_BASE}/api/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: '/vault-load-from-chain', args: [PASSWORD] }),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  console.log('Response status:', res.status);
  console.log('Response body:', JSON.stringify(data, null, 2));

  if (data.ok && data.notes !== undefined) {
    console.log('OK – notes Länge:', typeof data.notes === 'string' ? data.notes.length : '-');
    process.exit(0);
  }
  console.error('Von Chain laden fehlgeschlagen:', data.message || data.error || text);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
