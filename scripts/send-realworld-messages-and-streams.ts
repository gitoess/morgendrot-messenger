/**
 * Eine npm für alle UI-Funktionen: erzeugt echte Daten für Nachrichten, Streams, Keys und Tickets,
 * damit alle Bereiche der UI (Posteingang, Streams, Zugang) sichtbar befüllt sind.
 *
 * - Keys + Tickets → Zugang → Schlüssel (Keys/Tickets in der UI)
 * - /send-plain → Posteingang (Nachrichten → Privat/Pinnwand → Aktualisieren)
 * - /streams-publish → Lite-UI: Streams → „Fetch (Empfangen)“
 *
 * Voraussetzung: Backend läuft, Wallet entsperrt. Keys/Tickets: ROLE=boss oder ALLOW_TEST_ROLE_OVERRIDE.
 *
 * Aufruf: npm run seed:ui   (empfohlen – eine npm für alle Funktionen)
 *         npm run send:ui-messages   (Alias)
 */

const BASE = process.env.API_URL || 'http://127.0.0.1:3342';

async function get(path: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(BASE + path);
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: r.status, json };
}

async function post(path: string, data: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: r.status, json };
}

function cmd(cmdName: string, args: string[] = []): Promise<{ status: number; json: Record<string, unknown> }> {
  return post('/api/command', { cmd: cmdName, args });
}

async function setConfig(key: string, value: string): Promise<{ status: number; json: Record<string, unknown> }> {
  return post('/api/config', { key, value });
}

async function main() {
  console.log('=== Real-World: Nachrichten + Streams für UI sichtbar machen ===\n');
  console.log('API:', BASE);

  let status: { status: number; json: Record<string, unknown> };
  try {
    status = await get('/api/status');
  } catch (e) {
    const cause = (e as { cause?: { code?: string } })?.cause;
    if (cause?.code === 'ECONNREFUSED') {
      console.error('\nBackend läuft nicht (Verbindung zu ' + BASE + ' abgelehnt).');
      console.error('Starte zuerst das Backend, z. B.: npm run start:secrets');
      process.exit(1);
    }
    throw e;
  }
  if (status.status !== 200) {
    console.error('Backend nicht erreichbar. Starte: npm run start:secrets');
    process.exit(1);
  }
  if (status.json.locked === true) {
    console.error('Wallet gesperrt. Bitte zuerst in der UI entsperren.');
    process.exit(1);
  }

  const ids = await get('/api/current-ids');
  const myAddress = ids.json.myAddress as string | undefined;
  if (!myAddress) {
    console.error('MY_ADDRESS nicht gesetzt.');
    process.exit(1);
  }
  console.log('Eigene Adresse:', myAddress.slice(0, 14) + '…\n');

  // Keys/Tickets erfordern ROLE=boss – einmal versuchen, Rolle per API zu setzen (funktioniert mit ALLOW_TEST_ROLE_OVERRIDE=true)
  const roleBefore = (status.json.role as string) || '';
  const roleSet = await setConfig('ROLE', 'boss');
  const isBoss = roleSet.status === 200 || roleBefore === 'boss';
  if (!isBoss) {
    await setConfig('ROLE', roleBefore || 'messenger');
  }

  // --- Keys (Zugang → Schlüssel in der UI) ---
  const lockId = myAddress; // Lock = eigene Adresse für Demo
  console.log('--- Keys (Zugang → Schlüssel in der UI) ---');
  const keyRes1 = await cmd('/create-key', [lockId, myAddress, '7']);
  const keyOk1 = keyRes1.status === 200 && keyRes1.json.ok !== false;
  console.log(keyOk1 ? '  OK create-key (1 Key, 7 Tage TTL)' : '  create-key: ' + ((keyRes1.json.error as string) || keyRes1.json.message || keyRes1.status) + ' (ROLE=boss in .env oder ALLOW_TEST_ROLE_OVERRIDE=true?)');
  const keyRes2 = await cmd('/create-key', [lockId, myAddress, '30']);
  const keyOk2 = keyRes2.status === 200 && keyRes2.json.ok !== false;
  if (keyOk2) console.log('  OK create-key (2. Key, 30 Tage)');
  console.log('\n→ In der UI: Zugang → Schlüssel → Keys auflisten / Aktualisieren.\n');

  // --- Tickets (Zugang → Tickets in der UI) ---
  const eventId = '0x' + 'e'.repeat(64);
  const validFrom = '0';
  const validUntil = String(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 Tage ab jetzt (ms)
  const metadata = '';
  console.log('--- Tickets (Zugang → Tickets in der UI) ---');
  const ticketRes1 = await cmd('/create-ticket', [eventId, validFrom, validUntil, metadata, myAddress]);
  const ticketOk1 = ticketRes1.status === 200 && ticketRes1.json.ok !== false;
  console.log(ticketOk1 ? '  OK create-ticket (1 Ticket)' : '  create-ticket: ' + ((ticketRes1.json.error as string) || ticketRes1.json.message || ticketRes1.status) + ' (ROLE=boss in .env oder ALLOW_TEST_ROLE_OVERRIDE=true?)');
  const ticketRes2 = await cmd('/create-ticket', [eventId, validFrom, validUntil, metadata, myAddress]);
  const ticketOk2 = ticketRes2.status === 200 && ticketRes2.json.ok !== false;
  if (ticketOk2) console.log('  OK create-ticket (2. Ticket)');
  console.log('\n→ In der UI: Zugang → Schlüssel → Reiter Tickets / Aktualisieren.\n');

  // Rolle ggf. zurücksetzen
  if (!isBoss && roleBefore) await setConfig('ROLE', roleBefore);

  // --- Mailbox/On-Chain: Klartext an sich selbst (erscheint im Posteingang) ---
  console.log('--- Nachrichten (Posteingang in der UI) ---');
  const texts = [
    'Real-World Test 1 – sichtbar im Posteingang',
    'Real-World Test 2 – Nachricht vom Skript',
    'Real-World Test 3 – ' + new Date().toLocaleTimeString('de-DE'),
  ];
  for (let i = 0; i < texts.length; i++) {
    const res = await cmd('/send-plain', [myAddress, texts[i]!]);
    const ok = res.status === 200 && res.json.ok !== false;
    console.log(ok ? `  OK: "${texts[i]!.slice(0, 40)}…"` : `  Fehler: ${(res.json.error as string) || res.json.message || res.status}`);
  }
  console.log('\n→ In der UI: Nachrichten → Privat oder Pinnwand → Posteingang → „Aktualisieren“ klicken.\n');

  // --- Streams (Lite-UI: Streams → Fetch) ---
  console.log('--- Streams (Lite-UI: Tab Streams → Fetch) ---');
  const streamsCreate = await cmd('/streams-create', []);
  if (streamsCreate.status === 200 && streamsCreate.json.ok !== false) {
    console.log('  OK streams-create (Kanal erstellt bzw. bereits vorhanden)');
  } else {
    console.log('  streams-create: ' + ((streamsCreate.json.error as string) || streamsCreate.json.message || 'STREAMS_BRIDGE_URL setzen') + ' – überspringe Streams.');
  }

  const streamPayloads = [
    'Streams Real-World 1 – ' + new Date().toISOString(),
    'Streams Real-World 2 – sichtbar nach Fetch in der Lite-UI',
  ];
  for (let i = 0; i < streamPayloads.length; i++) {
    const res = await cmd('/streams-publish', [streamPayloads[i]!]);
    const ok = res.status === 200 && res.json.ok !== false;
    console.log(ok ? `  OK streams-publish: "${streamPayloads[i]!.slice(0, 35)}…"` : `  streams-publish: ${(res.json.error as string) || res.json.message || res.status}`);
  }

  const fetchRes = await cmd('/streams-fetch', []);
  if (fetchRes.status === 200 && fetchRes.json.ok !== false) {
    console.log('  OK streams-fetch (Nachrichten abgerufen)');
  } else {
    console.log('  streams-fetch: ' + ((fetchRes.json.error as string) || fetchRes.json.message || '–'));
  }
  console.log('\n→ Lite-UI: Kachel Streams → „Fetch (Empfangen)“ – Ausgabe erscheint unten.\n');

  console.log('Fertig.');
  console.log('  • Nachrichten: Nachrichten → Posteingang → Aktualisieren');
  console.log('  • Keys/Tickets: Zugang → Schlüssel → Keys/Tickets (Aktualisieren)');
  console.log('  • Streams: Lite-UI (Port 3342) → Streams → Fetch');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
