/**
 * Test: Vault lokal speichern und laden (Passwort aus UI/args).
 * Voraussetzung: Backend läuft (z. B. npm run start:secrets, Port 3342).
 *
 *   API_BASE=http://127.0.0.1:3342 npx tsx scripts/test-vault-load-save.ts
 *   (Optional: VAULT_PASSWORD=123)
 */

const API_BASE = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const PASSWORD = process.env.VAULT_PASSWORD || '123';

async function post(path: string, body: object): Promise<{ ok?: boolean; message?: string; error?: string; notes?: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text.slice(0, 200)}`);
  return data;
}

async function main() {
  console.log('API_BASE:', API_BASE);
  console.log('Passwort: ', PASSWORD ? '***' : '(leer)');

  const status = await fetch(`${API_BASE}/api/status`).then((r) => r.ok ? r.json() : null).catch(() => null);
  if (!status) {
    console.error('Backend nicht erreichbar. Bitte starten: npm run start:secrets');
    process.exit(1);
  }

  try {
    await post('/api/unlock', { password: PASSWORD });
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    if (!msg.includes('Bereits entsperrt')) throw e;
  }
  console.log('Unlock: OK');

  const saveRes = await post('/api/command', { cmd: '/vault-save', args: [PASSWORD, 'test-notes-' + Date.now()] });
  if (!saveRes.ok) {
    console.error('vault-save fehlgeschlagen:', saveRes.message || saveRes.error);
    process.exit(1);
  }
  console.log('vault-save:', saveRes.message);

  const lockRes = await post('/api/command', { cmd: '/vault-lock', args: [] });
  if (!lockRes.ok) {
    console.error('vault-lock fehlgeschlagen:', lockRes.message);
    process.exit(1);
  }
  console.log('vault-lock: OK');

  const loadRes = await post('/api/command', { cmd: '/vault-load', args: [PASSWORD] });
  if (!loadRes.ok) {
    console.error('vault-load fehlgeschlagen:', loadRes.message || loadRes.error);
    process.exit(1);
  }
  const notes = (loadRes as { notes?: string }).notes;
  if (notes === undefined) {
    console.error('vault-load: Antwort enthält kein "notes".');
    process.exit(1);
  }
  if (!notes.startsWith('test-notes-')) {
    console.error('vault-load: notes unerwartet:', notes.slice(0, 50) + (notes.length > 50 ? '…' : ''));
    process.exit(1);
  }
  console.log('vault-load: OK, notes geladen (Länge', notes.length, ')');
  console.log('Test bestanden.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
