/**
 * Nachrichten & Chat – alle Real-Life-Szenarien und Optionen durchtesten (2 Instanzen).
 *
 * Deckt ab: Einrichtung, API-Abfragen, optional Geheimnis-Peering (/pairing-*), klassischer
 * Handshake+Connect, verschlüsselt senden/fetch, Sender-Filter, Klartext, Folgeoptionen,
 * optional /vault-save + Prüfung vaultStatus.hasLocal.
 *
 * Voraussetzung: Zwei laufende Morgendrot-Instanzen (z. B. Port 3342 und 3343),
 * beide Wallet entsperrt. Env: UNLOCK_PASSWORD (beide gleich) oder getrennt
 * UNLOCK_PASSWORD_A / UNLOCK_PASSWORD_B (optional), API_BASE_A/B, PAIRING_SECRET (min. 6 Zeichen),
 * SKIP_PEERING=1 (nur klassischer Handshake).
 *
 * Aufruf: npm run test:messages  oder  npm run test:messenger
 * Optional: MESSAGES_TEST_TIMEOUT_MS (ms, default 20000) für fetch-Timeout wenn APIs fehlen.
 */

const API_A = process.env.API_BASE_A || 'http://127.0.0.1:3342';
const API_B = process.env.API_BASE_B || 'http://127.0.0.1:3343';
const UNLOCK_PASSWORD = (process.env.UNLOCK_PASSWORD || '').trim();
/** Terminal A (3342) / Terminal B (3343) – Fallback: UNLOCK_PASSWORD für beide. */
const UNLOCK_PASSWORD_A = (process.env.UNLOCK_PASSWORD_A || UNLOCK_PASSWORD).trim();
const UNLOCK_PASSWORD_B = (process.env.UNLOCK_PASSWORD_B || UNLOCK_PASSWORD).trim();
const PAIRING_SECRET = (process.env.PAIRING_SECRET || 'rwmsg-peer-test-9').trim();
const SKIP_PEERING = process.env.SKIP_PEERING === '1' || process.env.SKIP_PEERING === 'true';
/** Ohne laufende APIs hängt fetch sonst sehr lange (TCP). */
const FETCH_TIMEOUT_MS = Math.max(3000, parseInt(process.env.MESSAGES_TEST_TIMEOUT_MS || '20000', 10) || 20000);

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function apiGet(base: string, path: string): Promise<unknown> {
  const res = await fetchWithTimeout(`${base}${path}`, { method: 'GET' });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function apiPost(base: string, path: string, body: object): Promise<unknown> {
  const res = await fetchWithTimeout(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`POST ${path}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

type CommandResult = { ok?: boolean; message?: string; error?: string };
async function command(base: string, cmd: string, args: string[]): Promise<CommandResult> {
  return apiPost(base, '/api/command', { cmd, args }) as Promise<CommandResult>;
}

function isUnknownCommand(r: CommandResult): boolean {
  return /\bUnbekannter Befehl\b/i.test(String(r.message || r.error || ''));
}

function log(step: string, ok: boolean, detail?: string) {
  const s = ok ? 'OK' : 'FAIL';
  console.log(`  [${s}] ${step}${detail ? ' – ' + detail : ''}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitConnected(base: string, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const st = (await apiGet(base, '/api/status').catch(() => ({}))) as { connected?: boolean };
    if (st.connected === true) return true;
    await sleep(1500);
  }
  return false;
}

function vaultSaveArgs(password: string, includeSdkMnemonic?: boolean): string[] {
  const a: string[] = [password, ''];
  if (includeSdkMnemonic) {
    a.push('');
    a.push('includeIotaMnemonic');
  }
  return a;
}

async function main() {
  console.log('\n=== Nachrichten & Chat – alle Real-Life-Szenarien & Optionen ===\n');

  let addrA: string, addrB: string;
  try {
    const idsA = (await apiGet(API_A, '/api/current-ids')) as { myAddress?: string; packageId?: string };
    addrA = idsA.myAddress || '';
    const idsB = (await apiGet(API_B, '/api/current-ids')) as { myAddress?: string; packageId?: string };
    addrB = idsB.myAddress || '';
    if (!addrA || !addrB) throw new Error('Beide Instanzen brauchen MY_ADDRESS (current-ids).');
    const pkgA = (idsA.packageId || '').trim().toLowerCase();
    const pkgB = (idsB.packageId || '').trim().toLowerCase();
    if (pkgA && pkgB && pkgA !== pkgB) {
      console.warn(
        'WARNUNG: PACKAGE_ID unterscheidet sich (A vs. B). Peering und verschlüsselter Chat brauchen dieselbe ID.\n'
      );
    }
    if (addrA === addrB) {
      console.log('Hinweis: A und B haben dieselbe Adresse (Ein-Instanz). Connect/Handshake braucht zwei getrennte Server.\n');
    }
  } catch (e) {
    const aborted =
      e &&
      typeof e === 'object' &&
      ('name' in e ? (e as { name?: string }).name === 'AbortError' : false);
    if (aborted) {
      console.error(
        `Keine Antwort von API (${FETCH_TIMEOUT_MS}ms Timeout). Zwei Messenger starten (z. B. 3342 + 3343), ggf. API_BASE_A / API_BASE_B setzen.`
      );
    } else {
      console.error('Voraussetzung: Zwei erreichbare APIs (A und B) mit gesetzter MY_ADDRESS.', e);
    }
    process.exit(1);
  }

  console.log('Instanz A (Alice):', addrA.slice(0, 18) + '…');
  console.log('Instanz B (Bob):  ', addrB.slice(0, 18) + '…\n');

  // ═══ 1. Einrichtung & API-Abfragen ═══
  console.log('--- 1. Einrichtung & API-Abfragen ---');
  const reachA = (await apiGet(API_A, '/api/chain-reachable').catch(() => ({ reachable: false }))) as { reachable?: boolean };
  log('A: GET /api/chain-reachable', reachA.reachable === true, reachA.reachable ? 'Kette erreichbar' : 'nicht erreichbar / skip');

  const addrsA = (await apiGet(API_A, '/api/connect-addresses').catch(() => ({}))) as { addresses?: string[] };
  log('A: GET /api/connect-addresses', Array.isArray(addrsA.addresses), addrsA.addresses ? `${addrsA.addresses.length} Adresse(n)` : '–');
  const addrsB = (await apiGet(API_B, '/api/connect-addresses').catch(() => ({}))) as { addresses?: string[] };
  log('B: GET /api/connect-addresses', Array.isArray(addrsB.addresses), addrsB.addresses ? `${addrsB.addresses.length} Adresse(n)` : '–');

  const statusA0 = (await apiGet(API_A, '/api/status').catch(() => ({}))) as { connected?: boolean; locked?: boolean };
  const statusB0 = (await apiGet(API_B, '/api/status').catch(() => ({}))) as { connected?: boolean; locked?: boolean };
  log('A: GET /api/status (vor Connect)', true, `connected=${statusA0.connected}, locked=${statusA0.locked}`);
  log('B: GET /api/status (vor Connect)', true, `connected=${statusB0.connected}, locked=${statusB0.locked}`);

  const helpA = (await apiGet(API_A, '/api/help').catch(() => ({}))) as { helpText?: string };
  log('A: GET /api/help (vor Connect)', typeof helpA.helpText === 'string', helpA.helpText ? `${helpA.helpText.length} Zeichen` : '–');

  const findB = (await apiGet(API_B, '/api/find-peer-handshake').catch(() => ({}))) as { found?: boolean };
  log('B: GET /api/find-peer-handshake (vor Handshake)', true, findB.found ? 'Handshake gefunden' : 'Kein Handshake');

  // Optional: Unlock A/B (400 „Bereits entsperrt“ = OK); je eigenes Passwort möglich
  if (UNLOCK_PASSWORD_A || UNLOCK_PASSWORD_B) {
    const tryUnlock = async (label: string, base: string, password: string) => {
      if (!password) {
        log(`${label}: POST /api/unlock`, true, 'übersprungen (kein Passwort für diese Instanz)');
        return;
      }
      try {
        await apiPost(base, '/api/unlock', { password });
        log(`${label}: POST /api/unlock`, true);
      } catch (e: unknown) {
        const m = String((e as Error)?.message || e);
        if (/Bereits entsperrt/i.test(m)) log(`${label}: POST /api/unlock`, true, 'war schon entsperrt');
        else log(`${label}: POST /api/unlock`, false, m);
      }
    };
    await tryUnlock('A', API_A, UNLOCK_PASSWORD_A);
    await tryUnlock('B', API_B, UNLOCK_PASSWORD_B);
  } else {
    console.log('  (Kein UNLOCK_PASSWORD / UNLOCK_PASSWORD_A|B – Wallets vorher in der UI entsperren.)\n');
  }

  // ═══ 2. Verbindung: zuerst Geheimnis-Peering (wenn möglich), sonst klassischer Handshake ═══
  const cancelStaleConnect = async () => {
    const ca = await command(API_A, '/cancel-connect', []);
    log('A: /cancel-connect (vor Verbindungstest)', ca.ok === true, ca.message || ca.error || '');
    const cb = await command(API_B, '/cancel-connect', []);
    const bSkipOld = isUnknownCommand(cb);
    log(
      'B: /cancel-connect (vor Verbindungstest)',
      cb.ok === true || bSkipOld,
      bSkipOld ? 'API ohne /cancel-connect (Stand aktualisieren) – ggf. Messenger neu starten' : cb.message || cb.error || ''
    );
  };
  await cancelStaleConnect();

  let usedPairing = false;
  const readPairStatus = async () => {
    const a = (await apiGet(API_A, '/api/status').catch(() => ({}))) as { connected?: boolean };
    const b = (await apiGet(API_B, '/api/status').catch(() => ({}))) as { connected?: boolean };
    return { a, b, both: Boolean(a.connected && b.connected) };
  };

  if (!SKIP_PEERING && PAIRING_SECRET.length >= 6) {
    const before = await readPairStatus();
    if (!before.a.connected && !before.b.connected) {
      console.log(
        '\n--- 2a. Geheimnis-Peering (/pairing-offer → /pairing-wait → /pairing-find → /connect B) ---\n' +
          'Hinweis: In beiden .env dieselbe RPC_URL (z. B. https://api.testnet.iota.cafe), sonst findet B das Angebot nicht.\n'
      );
      const offer = await command(API_A, '/pairing-offer', [PAIRING_SECRET, 'RW-Messages', '120']);
      log('A: /pairing-offer', offer.ok === true, offer.message || offer.error || '');
      const waitP = await command(API_A, '/pairing-wait', []);
      log('A: /pairing-wait', waitP.ok === true, waitP.message || waitP.error || '');
      await sleep(10_000);
      const findP = await command(API_B, '/pairing-find', [PAIRING_SECRET]);
      log('B: /pairing-find', findP.ok === true, findP.message || findP.error || '');
      const aPeer = await waitConnected(API_A, 120_000);
      log('A: Status connected (nach Peering)', aPeer);
      const connectBP = await command(API_B, '/connect', []);
      log('B: /connect nach Peering', connectBP.ok === true, connectBP.message || connectBP.error || '');
      const bPeer = await waitConnected(API_B, 120_000);
      log('B: Status connected (nach Peering)', bPeer);
      usedPairing = Boolean(
        offer.ok === true &&
          waitP.ok === true &&
          findP.ok === true &&
          aPeer &&
          connectBP.ok === true &&
          bPeer
      );
      if (usedPairing) console.log('   Peering-Pfad erfolgreich – klassischer Handshake in 2b wird übersprungen.\n');
      else console.log('   Peering unvollständig – es folgt klassischer Handshake (2b).\n');
    } else {
      console.log('\n--- 2a. Geheimnis-Peering übersprungen (bereits verbunden) ---\n');
    }
  } else if (SKIP_PEERING) {
    console.log('\n--- 2a. Geheimnis-Peering übersprungen (SKIP_PEERING) ---\n');
  } else {
    console.log('\n--- 2a. Geheimnis-Peering übersprungen (PAIRING_SECRET < 6 Zeichen) ---\n');
  }

  let mid = await readPairStatus();
  if (!mid.both) {
    console.log('--- 2b. Handshake & Connect (klassisch) ---');
    const connectPromise = command(API_B, '/connect', [addrA]).catch((e): CommandResult => ({
      ok: false,
      error: String((e as Error)?.message || e),
    }));
    await sleep(2500);
    const handshakeRes = await command(API_A, '/handshake', [addrB]);
    log('A: /handshake an B', handshakeRes.ok === true, handshakeRes.message || handshakeRes.error);
    const connectRes = await connectPromise;
    log('B: /connect (wartet auf A)', connectRes.ok === true, connectRes.message || connectRes.error);

    if (!connectRes.ok) {
      console.log('   Connect fehlgeschlagen – weitere Tests übersprungen.\n');
      console.log('=== Ende Nachrichten & Chat ===\n');
      return;
    }

    await sleep(2000);
    const connectA = await command(API_A, '/connect', [addrB]);
    log('A: /connect (holt B-Antwort)', connectA.ok === true, connectA.message || connectA.error);
    let bothReady = false;
    for (let i = 0; i < 90; i++) {
      await sleep(2000);
      const statusA = (await apiGet(API_A, '/api/status').catch(() => ({}))) as { connected?: boolean };
      const statusB = (await apiGet(API_B, '/api/status').catch(() => ({}))) as { connected?: boolean };
      if (statusA.connected && statusB.connected) {
        bothReady = true;
        break;
      }
    }
    if (!bothReady) {
      console.log('   Hinweis: Nach 180s nicht beide „verbunden“ – Chain/RPC langsam oder Handshake fehlt; /send kann fehlschlagen.');
    }
  } else if (usedPairing) {
    console.log('--- 2b. Handshake & Connect (klassisch) – übersprungen (Peering aktiv) ---');
  } else {
    console.log('--- 2b. Handshake & Connect (klassisch) – übersprungen (war schon verbunden) ---');
  }

  const statusA1 = (await apiGet(API_A, '/api/status')) as { connected?: boolean; partnerCount?: number };
  const statusB1 = (await apiGet(API_B, '/api/status')) as { connected?: boolean; partnerCount?: number };
  log('A: GET /api/status (nach Connect)', statusA1.connected === true, `connected=${statusA1.connected}, partnerCount=${statusA1.partnerCount ?? '?'}`);
  log('B: GET /api/status (nach Connect)', statusB1.connected === true, `connected=${statusB1.connected}, partnerCount=${statusB1.partnerCount ?? '?'}`);

  if (!statusA1.connected || !statusB1.connected) {
    console.log('   Mindestens eine Seite nicht verbunden – Nachrichten-Tests werden übersprungen.\n');
    console.log('=== Ende Nachrichten & Chat ===\n');
    return;
  }

  const helpA2 = (await apiGet(API_A, '/api/help').catch(() => ({}))) as { helpText?: string };
  log('A: GET /api/help (nach Connect)', typeof helpA2.helpText === 'string', helpA2.helpText?.includes('send') ? 'Chat-Help' : '–');

  // ═══ 3. Verschlüsselte Nachrichten ═══
  console.log('\n--- 3. Verschlüsselte Nachrichten ---');
  const send1 = await command(API_A, '/send', ['Test von A an B']);
  log('A: /send "Test von A an B"', send1.ok === true, send1.message || send1.error);

  await sleep(3000);

  const fetchB = (await apiPost(API_B, '/api/command', { cmd: '/fetch', args: ['10'] })) as { ok?: boolean; messages?: Array<{ sender?: string; text?: string }>; error?: string };
  const messagesB = fetchB.messages || [];
  const hasFromA = messagesB.some((m) => (m.text || '').includes('Test von A an B'));
  log('B: /fetch 10 – Nachricht von A sichtbar', fetchB.ok === true && hasFromA, fetchB.ok ? `${messagesB.length} Nachricht(en)` : fetchB.error);

  const send2 = await command(API_B, '/send', ['Antwort von B an A']);
  log('B: /send "Antwort von B an A"', send2.ok === true, send2.message || send2.error);

  await sleep(3000);

  const fetchA = (await apiPost(API_A, '/api/command', { cmd: '/fetch', args: ['10'] })) as { ok?: boolean; messages?: Array<{ sender?: string; text?: string }>; error?: string };
  const messagesA = fetchA.messages || [];
  const hasFromB = messagesA.some((m) => (m.text || '').includes('Antwort von B an A'));
  log('A: /fetch 10 – Antwort von B sichtbar', fetchA.ok === true && hasFromB, fetchA.ok ? `${messagesA.length} Nachricht(en)` : fetchA.error);

  // Zweite Nachricht von A (alle Optionen durchspielen)
  const send3 = await command(API_A, '/send', ['Zweite Nachricht A→B']);
  log('A: /send "Zweite Nachricht A→B"', send3.ok === true, send3.message || send3.error);
  await sleep(2000);

  // ═══ 4. Fetch mit Sender-Filter (Option: /fetch n 0x…) ═══
  console.log('\n--- 4. Fetch mit Sender-Filter ---');
  const fetchBFromA = (await apiPost(API_B, '/api/command', { cmd: '/fetch', args: ['5', addrA] })) as { ok?: boolean; messages?: Array<{ text?: string }> };
  log('B: /fetch 5 <addrA> (nur von A)', fetchBFromA.ok === true, fetchBFromA.ok ? `${(fetchBFromA.messages || []).length} Nachricht(en)` : '–');

  const fetchAFromB = (await apiPost(API_A, '/api/command', { cmd: '/fetch', args: ['5', addrB] })) as { ok?: boolean; messages?: Array<{ text?: string }> };
  log('A: /fetch 5 <addrB> (nur von B)', fetchAFromB.ok === true, fetchAFromB.ok ? `${(fetchAFromB.messages || []).length} Nachricht(en)` : '–');

  // Fetch mit anderer Anzahl (Option n)
  const fetchB3 = (await apiPost(API_B, '/api/command', { cmd: '/fetch', args: ['3'] })) as { ok?: boolean; messages?: unknown[] };
  log('B: /fetch 3 (kleinere Anzahl)', fetchB3.ok === true, fetchB3.ok ? `${(fetchB3.messages || []).length} Nachricht(en)` : '–');

  // ═══ 5. Klartext (/send-plain) ═══
  console.log('\n--- 5. Klartext (/send-plain) ---');
  const sendPlain = await command(API_A, '/send-plain', [addrB, 'Klartext-Test von A']);
  if (sendPlain.ok) {
    log('A: /send-plain an B', true, sendPlain.message);
    await sleep(3000);
    const fetchB2 = (await apiPost(API_B, '/api/command', { cmd: '/fetch', args: ['5'] })) as { ok?: boolean; messages?: Array<{ text?: string }> };
    const hasPlain = (fetchB2.messages || []).some((m) => (m.text || '').includes('Klartext-Test von A'));
    log('B: /fetch – Klartext sichtbar', hasPlain, hasPlain ? 'Ja' : 'Nein (evtl. ENABLE_PLAINTEXT_CHANNEL)');
  } else {
    log('A: /send-plain', false, sendPlain.error || sendPlain.message || 'evtl. deaktiviert');
  }

  // ═══ 6. Folgeoptionen ═══
  console.log('\n--- 6. Folgeoptionen ---');
  const connectAddrsA2 = (await apiGet(API_A, '/api/connect-addresses').catch(() => ({}))) as { addresses?: string[] };
  log('A: GET /api/connect-addresses (nach Connect)', Array.isArray(connectAddrsA2.addresses), connectAddrsA2.addresses ? `${connectAddrsA2.addresses.length} Adresse(n)` : '–');

  const findA = (await apiGet(API_A, '/api/find-peer-handshake').catch(() => ({}))) as { found?: boolean };
  log('A: GET /api/find-peer-handshake (nach Connect)', true, findA.found ? 'Handshake gefunden' : 'Kein Handshake');

  // Optional: /purge-handshake (braucht ENABLE_PURGE + MAILBOX; würde Session trennen)
  const purgeHandshake = await command(API_A, '/purge-handshake', []).catch((): CommandResult => ({
    ok: false,
    error: 'skip',
  }));
  const purgeSkip = !purgeHandshake.ok && /MAILBOX_ID|Purge deaktiviert|purge/i.test(purgeHandshake.error || purgeHandshake.message || '');
  if (purgeHandshake.ok) {
    log('A: /purge-handshake (Folgeoption)', true, purgeHandshake.message);
  } else {
    log('A: /purge-handshake (Folgeoption)', purgeSkip, purgeSkip ? purgeHandshake.error || purgeHandshake.message : (purgeHandshake.error || purgeHandshake.message || '–'));
  }

  // ═══ 7. Vault lokal sichern (API) ═══
  console.log('\n--- 7. Vault (/vault-save) + hasLocal ---');
  if (UNLOCK_PASSWORD_A || UNLOCK_PASSWORD_B) {
    const inc = process.env.VAULT_SAVE_INCLUDE_SDK === '1';
    if (UNLOCK_PASSWORD_A) {
      const vsA = await command(API_A, '/vault-save', vaultSaveArgs(UNLOCK_PASSWORD_A, inc));
      log('A: /vault-save', vsA.ok === true, vsA.message || vsA.error || '');
    } else {
      log('A: /vault-save', true, 'übersprungen (kein UNLOCK_PASSWORD_A)');
    }
    if (UNLOCK_PASSWORD_B) {
      const vsB = await command(API_B, '/vault-save', vaultSaveArgs(UNLOCK_PASSWORD_B, inc));
      log('B: /vault-save', vsB.ok === true, vsB.message || vsB.error || '');
    } else {
      log('B: /vault-save', true, 'übersprungen (kein UNLOCK_PASSWORD_B)');
    }
    const stVA = (await apiGet(API_A, '/api/status').catch(() => ({}))) as { vaultStatus?: { hasLocal?: boolean } };
    const stVB = (await apiGet(API_B, '/api/status').catch(() => ({}))) as { vaultStatus?: { hasLocal?: boolean } };
    log('A: vaultStatus.hasLocal', stVA.vaultStatus?.hasLocal === true);
    log('B: vaultStatus.hasLocal', stVB.vaultStatus?.hasLocal === true);
  } else {
    console.log('  (Kein Vault-Passwort – /vault-save übersprungen.)\n');
  }

  console.log('\n=== Ende Nachrichten & Chat ===');
  console.log(
    'Durchgespielt: Einrichtung, optional Geheimnis-Peering, klassischer Handshake+Connect, /send, /fetch, Sender-Filter, /send-plain, purge-handshake, /vault-save + hasLocal.'
  );
  console.log(
    'Env: UNLOCK_PASSWORD_A / UNLOCK_PASSWORD_B (oder UNLOCK_PASSWORD); SKIP_PEERING=1; PAIRING_SECRET=…; VAULT_SAVE_INCLUDE_SDK=1.\n'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
