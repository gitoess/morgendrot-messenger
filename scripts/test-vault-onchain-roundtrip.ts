/**
 * Test: Vault on-chain speichern und danach von der Chain laden (kompletter Durchlauf).
 * Voraussetzung: Backend läuft, VAULT_REGISTRY_ID + PACKAGE_ID in .env gesetzt, Wallet entsperrt oder Passwort angegeben.
 *
 *   API_BASE=http://127.0.0.1:3342 VAULT_PASSWORD=123 npx tsx scripts/test-vault-onchain-roundtrip.ts
 */

const API_BASE = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const PASSWORD = process.env.VAULT_PASSWORD || '123';

async function cmd(cmdName: string, args: unknown[]): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: cmdName, args }),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(String(data.message || data.error || text));
  return data;
}

async function getConfig(): Promise<{ VAULT_REGISTRY_ID?: string; PACKAGE_ID?: string }> {
  const res = await fetch(`${API_BASE}/api/config`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const list = (res?.config as { envKey?: string; key?: string; value?: string }[]) ?? [];
  const out: Record<string, string> = {};
  for (const item of list) {
    const key = item?.envKey ?? item?.key;
    if (key && item.value !== undefined) out[key] = item.value;
  }
  return out as { VAULT_REGISTRY_ID?: string; PACKAGE_ID?: string };
}

async function main() {
  console.log('API_BASE:', API_BASE);
  console.log('Passwort:', PASSWORD ? '***' : '(leer)\n');

  const config = await getConfig();
  const registryId = config.VAULT_REGISTRY_ID || '(nicht gesetzt)';
  const packageId = config.PACKAGE_ID ? config.PACKAGE_ID.slice(0, 22) + '…' : '(nicht gesetzt)';
  console.log('Backend-Konfig: VAULT_REGISTRY_ID =', registryId);
  console.log('                PACKAGE_ID       =', packageId);
  const noRegistry = !config.VAULT_REGISTRY_ID || config.VAULT_REGISTRY_ID === '(leer)';
  const noPackage = !config.PACKAGE_ID || config.PACKAGE_ID === '(leer)';
  if (noRegistry || noPackage) {
    console.error('VAULT_REGISTRY_ID und PACKAGE_ID müssen in .env gesetzt sein.');
    process.exit(1);
  }
  console.log('');

  const status = await fetch(`${API_BASE}/api/status`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!status) {
    console.error('Backend nicht erreichbar. Bitte starten: npm run start:secrets');
    process.exit(1);
  }
  try {
    await fetch(`${API_BASE}/api/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
  } catch {
    // ignore
  }

  if (!status.hasKeys) {
    console.log('1. Keine Keys im Speicher – zuerst lokal laden (vault-load) …');
    const loadLocal = await cmd('/vault-load', [PASSWORD]).catch(() => ({ ok: false }));
    if (!loadLocal.ok) {
      console.error('   vault-load fehlgeschlagen. Backend mit lokalem Vault starten oder in der UI „Lokal laden“ ausführen.');
      process.exit(1);
    }
    console.log('   OK – Keys geladen');
  } else {
    console.log('1. Status: hasKeys=true, myAddress=', status.myAddress ? status.myAddress.slice(0, 18) + '…' : '-');
  }

  const testNotes = 'test-onchain-roundtrip-' + Date.now();
  console.log('2. On-Chain speichern (Notes: ' + testNotes.slice(0, 25) + '…) …');
  const saveRes = await cmd('/vault-onchain', [PASSWORD, testNotes]).catch((e) => {
    console.error('   Fehler:', (e as Error).message);
    process.exit(1);
  });
  if (!saveRes.ok) {
    console.error('   vault-onchain fehlgeschlagen:', saveRes.message || saveRes.error);
    process.exit(1);
  }
  console.log('   OK:', saveRes.message);
  if (saveRes.digest) console.log('   TX-Digest:', saveRes.digest);
  if (saveRes.explorerLink) console.log('   Explorer:', saveRes.explorerLink);

  console.log('3. Warten auf Chain-Indexierung (Testnet: Dynamic Fields oft 10–15 s Verzögerung) …');
  await new Promise((r) => setTimeout(r, 15000));

  let listRes: Record<string, unknown> = {};
  let names: { type?: string; value?: unknown; bcs?: string }[] = [];
  const maxPollAttempts = 20;
  for (let poll = 0; poll < maxPollAttempts; poll++) {
    listRes = await cmd('/vault-list-chain', []).catch(() => ({ ok: false, names: [] }));
    names = ((listRes.names as { type?: string; value?: unknown; bcs?: string }[]) ?? []) as { type?: string; value?: unknown; bcs?: string }[];
    if (names.length > 0) break;
    if (poll < maxPollAttempts - 1) {
      console.log('   Dynamic Fields: 0 – warte 5 s (Versuch ' + (poll + 1) + '/' + maxPollAttempts + ') …');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  console.log('   Vault-Registry Dynamic Fields:', names.length, listRes.ok ? '' : '(' + String(listRes.message || 'Fehler') + ')');
  if (names.length) names.forEach((n, i) => console.log('     [' + i + '] type:', n.type, 'value:', n.value != null ? JSON.stringify(n.value) : '-', 'bcs:', n.bcs ? n.bcs.slice(0, 24) + '…' : '-'));
  if (names.length === 0) {
    const registryIdForHint = (listRes.registryId as string) || config.VAULT_REGISTRY_ID || '(unbekannt)';
    console.log('');
    console.log('   Hinweis (Registry-Falle / Indexer):');
    console.log('   - Im Explorer prüfen: ' + registryIdForHint);
    console.log('   - Tab „Dynamic Fields“: Siehst du einen Eintrag mit deiner Adresse (0x671bf6…)?');
    console.log('   - Wenn ja: RPC-Node hinkt hinterher (Stale Data). Backend-Neustart oder andere RPC_URL probieren.');
    console.log('   - Wenn nein: Nach Package-Redeploy kann sich die Registry-ID geändert haben. .env mit aktueller ID aus Deploy abgleichen.');
    console.log('');
  }

  console.log('4. Tresor sperren (vault-lock) …');
  const lockRes = await cmd('/vault-lock', []);
  if (!lockRes.ok) {
    console.error('   vault-lock fehlgeschlagen:', lockRes.message);
    process.exit(1);
  }
  console.log('   OK');

  console.log('5. Von Chain laden (vault-load-from-chain) …');
  let loadRes: { ok?: boolean; message?: string; error?: string; notes?: string } = { ok: false };
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      loadRes = await cmd('/vault-load-from-chain', [PASSWORD]) as { ok?: boolean; message?: string; notes?: string };
    } catch (e) {
      loadRes = { ok: false, message: (e as Error).message };
    }
    if (loadRes.ok) break;
    if (attempt < 5) {
      console.log('   Versuch ' + attempt + ' fehlgeschlagen, warte 5 s …');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  if (!(loadRes as { ok?: boolean }).ok) {
    console.error('   vault-load-from-chain fehlgeschlagen (nach 5 Versuchen):', (loadRes as { message?: string }).message || (loadRes as { error?: string }).error);
    process.exit(1);
  }
  const notes = (loadRes as { notes?: string }).notes;
  if (notes === undefined) {
    console.error('   Antwort enthält kein "notes".');
    process.exit(1);
  }
  if (notes !== testNotes) {
    console.error('   Notes stimmen nicht. Erwartet:', testNotes.slice(0, 40) + '…');
    console.error('   Bekommen:', (typeof notes === 'string' ? notes : JSON.stringify(notes)).slice(0, 80) + '…');
    process.exit(1);
  }
  console.log('   OK – Notes identisch (Länge ' + notes.length + ')');

  console.log('\nTest bestanden: Vault on-chain speichern → Von Chain laden funktioniert.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
