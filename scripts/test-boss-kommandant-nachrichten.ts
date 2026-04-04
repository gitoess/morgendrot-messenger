/**
 * Test: Streams + Klartext + verschlüsselt an Kommandant → Kommandant antwortet „alles ok“ → Boss sieht alle Nachrichten in der UI.
 *
 * Voraussetzung: Zwei Backends (Boss und Kommandant) laufen, gleiche PACKAGE_ID/MAILBOX_ID.
 *   API_BOSS=http://127.0.0.1:3342  API_KOMMANDANT=http://127.0.0.1:3343  npm run test:boss-kommandant-nachrichten
 *
 * Ablauf:
 * 1. Boss: ROLE=boss, KOMMANDANT_ADDRESSES=Kommandant-Adresse
 * 2. Kommandant: ROLE=kommandant, BOSS_ADDRESS=Boss-Adresse
 * 3. Boss → Handshake an Kommandant; Kommandant /connect (zu Boss)
 * 4. Boss sendet an Kommandant: Klartext, verschlüsselt, Streams-Publish
 * 5. Kommandant sendet an Boss: „alles ok“ (Klartext)
 * 6. Hinweis: In der UI als Boss → Nachrichten → „Boss-Übersicht“ → Aktualisieren → alle Nachrichten sichtbar
 */

const API_BOSS = process.env.API_BOSS || process.env.API_URL || 'http://127.0.0.1:3342';
const API_KOMMANDANT = process.env.API_KOMMANDANT || 'http://127.0.0.1:3343';

async function get(base: string, path: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(base + path);
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: r.status, json };
}

async function post(base: string, path: string, data: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: r.status, json };
}

function cmd(base: string, cmdName: string, args: string[] = []): Promise<{ status: number; json: Record<string, unknown> }> {
  return post(base, '/api/command', { cmd: cmdName, args });
}

function setConfig(base: string, key: string, value: string): Promise<{ status: number; json: Record<string, unknown> }> {
  return post(base, '/api/config', { key, value });
}

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function main() {
  console.log('=== Test: Boss → Kommandant (Streams, Klartext, verschlüsselt) → Kommandant „alles ok“ → Boss-Übersicht\n');
  console.log('Boss-API:', API_BOSS);
  console.log('Kommandant-API:', API_KOMMANDANT);

  const stBoss = await get(API_BOSS, '/api/status');
  const stKom = await get(API_KOMMANDANT, '/api/status');
  if (stBoss.status !== 200 || stBoss.json.locked === true) {
    console.error('Boss-Backend nicht erreichbar oder Wallet gesperrt.');
    process.exit(1);
  }
  if (stKom.status !== 200 || stKom.json.locked === true) {
    console.error('Kommandant-Backend nicht erreichbar oder Wallet gesperrt.');
    process.exit(1);
  }

  const idsBoss = await get(API_BOSS, '/api/current-ids');
  const idsKom = await get(API_KOMMANDANT, '/api/current-ids');
  const bossAddr = idsBoss.json.myAddress as string;
  const kommandantAddr = idsKom.json.myAddress as string;
  if (!bossAddr || !kommandantAddr) {
    console.error('MY_ADDRESS bei Boss oder Kommandant fehlt.');
    process.exit(1);
  }
  log('Boss: ' + bossAddr.slice(0, 14) + '…');
  log('Kommandant: ' + kommandantAddr.slice(0, 14) + '…\n');

  await setConfig(API_BOSS, 'ROLE', 'boss');
  await setConfig(API_BOSS, 'KOMMANDANT_ADDRESSES', kommandantAddr);
  await setConfig(API_KOMMANDANT, 'ROLE', 'kommandant');
  await setConfig(API_KOMMANDANT, 'BOSS_ADDRESS', bossAddr);
  log('Rollen gesetzt.\n');

  log('Boss sendet Handshake an Kommandant …');
  const rHandshake = await cmd(API_BOSS, '/handshake', [kommandantAddr]);
  if (rHandshake.status !== 200 || rHandshake.json.ok === false) {
    console.error('Handshake fehlgeschlagen:', rHandshake.json.message || rHandshake.json.error);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 2000));

  log('Kommandant verbindet mit Boss …');
  const rConnect = await cmd(API_KOMMANDANT, '/connect', [bossAddr]);
  if (rConnect.status !== 200 && rConnect.json.ok === false) {
    log('Connect-Warnung (evtl. schon verbunden): ' + String(rConnect.json.message || rConnect.json.error));
  } else {
    log('Verbunden.');
  }
  await new Promise((r) => setTimeout(r, 1500));

  log('Boss sendet Klartext an Kommandant …');
  await cmd(API_BOSS, '/send-plain', [kommandantAddr, 'Test Klartext an Kommandant – ' + new Date().toISOString()]);
  log('Boss sendet verschlüsselt an Kommandant …');
  await cmd(API_BOSS, '/send', ['Test verschlüsselt an Kommandant']);
  log('Boss veröffentlicht Streams-Nachricht …');
  await cmd(API_BOSS, '/streams-publish', ['Stream-Nachricht an Kommandant – ' + new Date().toISOString()]);
  await new Promise((r) => setTimeout(r, 1500));

  log('Kommandant sendet an Boss: „alles ok“ …');
  const rPlain = await cmd(API_KOMMANDANT, '/send-plain', [bossAddr, 'alles ok']);
  if (rPlain.status !== 200 || rPlain.json.ok === false) {
    console.error('Send-plain (alles ok) fehlgeschlagen:', rPlain.json.message || rPlain.json.error);
  } else {
    log('Gesendet.');
  }

  console.log('\n--- Fertig ---');
  console.log('Als Boss in der UI: Nachrichten → „Boss-Übersicht (an mich + an Kommandanten)“ aktivieren → „Aktualisieren“.');
  console.log('Dann siehst du: Nachrichten an dich (z. B. „alles ok“) und Klartext-Nachrichten an den Kommandanten.');
  console.log('Streams: Lite-UI (Port des Boss-Backends) → Streams → „Fetch (Empfangen)“.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
