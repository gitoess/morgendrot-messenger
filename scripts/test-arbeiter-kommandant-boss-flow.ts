/**
 * Test: Arbeiter → Kommandant → Boss → Kommandant → Pinnwand
 *
 * - Arbeiter: sendet alle 10 s einen Heartbeat (an Streams / Monitor; Kommandant „sieht“ ihn).
 * - Nach 30 s: Kommandant sendet an Boss: „Alles ok“.
 * - Nach 60 s: Boss sendet an Kommandant: „Sag dem Arbeiter, er soll Heartbeats einstellen.“
 * - Danach: Arbeiter stellt Heartbeats ein (Script stoppt den Timer).
 * - Kommandant sendet Bestätigung zur Pinnwand.
 *
 * Verwendet ein Backend (eine Instanz), Rollen werden per API gewechselt.
 * Voraussetzung: Backend läuft, Wallet entsperrt. Rollenwechsel im Test erfordert ALLOW_TEST_ROLE_OVERRIDE=true in .env und Backend-Neustart.
 */

const BASE = process.env.API_URL || 'http://127.0.0.1:3342';

async function get(path: string): Promise<{ status: number; json: Record<string, unknown> }> {
  let r: Response;
  try {
    r = await fetch(BASE + path);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err?.cause && String((err.cause as Error)?.message || '').includes('ECONNREFUSED')) {
      console.error('');
      console.error('Backend läuft nicht. Verbindung zu ' + BASE + ' abgelehnt.');
      console.error('  → In einem anderen Terminal starten:  npm run start:secrets');
      console.error('  → Wallet entsperren (Browser oder UNLOCK_PASSWORD), dann Test erneut ausführen.');
      console.error('');
      process.exit(1);
    }
    throw e;
  }
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: r.status, json };
}

async function post(path: string, data: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  let r: Response;
  try {
    r = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err?.cause && String((err.cause as Error)?.message || '').includes('ECONNREFUSED')) {
      console.error('');
      console.error('Backend läuft nicht. Verbindung zu ' + BASE + ' abgelehnt.');
      console.error('  → In einem anderen Terminal starten:  npm run start:secrets');
      console.error('');
      process.exit(1);
    }
    throw e;
  }
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: r.status, json };
}

function cmd(cmdName: string, args: string[] = []): Promise<{ status: number; json: Record<string, unknown> }> {
  return post('/api/command', { cmd: cmdName, args });
}

function setConfig(key: string, value: string): Promise<{ status: number; json: Record<string, unknown> }> {
  return post('/api/config', { key, value });
}

function log(msg: string) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] ${msg}`);
}

async function main() {
  console.log('=== Test: Arbeiter → Kommandant → Boss → Pinnwand ===\n');

  const status = await get('/api/status');
  if (status.status !== 200 || status.json.locked === true) {
    console.error('Backend nicht erreichbar oder Wallet gesperrt.');
    process.exit(1);
  }

  const ids = await get('/api/current-ids');
  const myAddress = ids.json.myAddress as string | undefined;
  if (!myAddress) {
    console.error('MY_ADDRESS fehlt.');
    process.exit(1);
  }
  log('Eigene Adresse (Boss/Kommandant/Arbeiter für Test): ' + myAddress.slice(0, 14) + '…\n');

  // Hierarchie für Solo-Test: alle Rollen = dieselbe Adresse. Rollenwechsel braucht ALLOW_TEST_ROLE_OVERRIDE=true.
  const rBoss = await setConfig('ROLE', 'boss');
  if (rBoss.status === 403) {
    console.error('Rollenwechsel abgelehnt. In .env setzen: ALLOW_TEST_ROLE_OVERRIDE=true, Backend neu starten, dann Test erneut ausführen.');
    process.exit(1);
  }
  await setConfig('BOSS_ADDRESS', myAddress);
  await setConfig('KOMMANDANT_ADDRESSES', myAddress);
  await setConfig('WORKER_ADDRESSES', myAddress);
  await setConfig('ROLE_ID', '14');

  // Pinnwand: für Test an dieselbe Adresse („an mich“ als Pinnwand-Empfänger)
  const pinnwandAddr = myAddress;
  await setConfig('ENABLE_BROADCAST_PINNWAND', 'true');
  await setConfig('BROADCAST_PINNWAND_ADDRESS', pinnwandAddr);
  await setConfig('BROADCAST_AUTHORIZED_SENDERS', myAddress);
  log('Pinnwand für Test: ' + pinnwandAddr.slice(0, 12) + '…\n');

  // —— Arbeiter: Heartbeat alle 10 s (ROLE_ID 14 = S-Bit für Send/Heartbeat) ——
  await setConfig('ROLE', 'arbeiter');
  await setConfig('ROLE_ID', '14'); // BW+L+S – nötig für Heartbeat
  const st = await get('/api/status');
  log('Arbeiter-Status: role=' + (st.json.role ?? '') + ', roleId=' + (st.json.roleId ?? ''));
  let heartbeatCount = 0;
  const heartbeatInterval = setInterval(async () => {
    heartbeatCount++;
    const res = await cmd('/heartbeat', []);
    const ok = res.status === 200 && res.json.ok !== false;
    log(ok ? `Arbeiter: Heartbeat #${heartbeatCount} gesendet` : `Arbeiter: Heartbeat fehlgeschlagen – ${(res.json.error as string) || res.json.message || ''}`);
  }, 10_000);
  log('Arbeiter gestartet: Heartbeat alle 10 s.\n');

  // —— Nach 30 s: Kommandant → Boss „Alles ok“ ——
  await new Promise((r) => setTimeout(r, 30_000));
  await setConfig('ROLE', 'kommandant');
  const r1 = await cmd('/send-plain', [myAddress, 'Alles ok – Kommandant meldet sich beim Boss.']);
  log(r1.status === 200 && r1.json.ok !== false ? 'Kommandant → Boss: „Alles ok“ gesendet.' : 'Kommandant → Boss: ' + ((r1.json.error as string) || r1.json.message || r1.status) + '\n');

  // —— Nach weiteren 30 s (gesamt 60 s): Boss → Kommandant „Sag Arbeiter, Heartbeats einstellen“ ——
  await new Promise((r) => setTimeout(r, 30_000));
  clearInterval(heartbeatInterval);
  log('Arbeiter: Heartbeats eingestellt (Timer gestoppt).\n');

  await setConfig('ROLE', 'boss');
  const r2 = await cmd('/send-plain', [myAddress, 'Sag dem Arbeiter, er soll die Heartbeats einstellen.']);
  log(r2.status === 200 && r2.json.ok !== false ? 'Boss → Kommandant: Anweisung gesendet.' : 'Boss → Kommandant: ' + ((r2.json.error as string) || r2.json.message || r2.status) + '\n');

  // —— Kommandant sendet Bestätigung zur Pinnwand ——
  await setConfig('ROLE', 'kommandant');
  const r3 = await cmd('/send-plain', [pinnwandAddr, 'Pinnwand: Bestätigung – Arbeiter hat Heartbeats auf Anweisung eingestellt.']);
  log(r3.status === 200 && r3.json.ok !== false ? 'Kommandant → Pinnwand: Bestätigung gesendet.' : 'Kommandant → Pinnwand: ' + ((r3.json.error as string) || r3.json.message || r3.status) + '\n');

  console.log('');
  console.log('--- Wo siehst du den Beweis? ---');
  console.log('');
  console.log('1. Nachrichten (Kommandant→Boss, Boss→Kommandant, Pinnwand):');
  console.log('   • Next-UI: Nachrichten → Privat oder Pinnwand → Posteingang → „Aktualisieren“');
  console.log('   • Lite-UI: ' + BASE + ' → Tab Nachrichten → Posteingang → Aktualisieren');
  console.log('');
  console.log('2. Heartbeats (Streams L0.5, kein Chain-Explorer):');
  console.log('   • Lite-UI: ' + BASE + ' → Tab Streams → Button „Fetch (Empfangen)“');
  console.log('   • Die Antwort unten auf der Seite enthält die Streams-Nachrichten (type: heartbeat, device, ts).');
  console.log('   • Hinweis: Streams liegen nicht on-chain; der IOTA-Explorer zeigt nur Chain-TX, keine Streams-Payloads.');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
