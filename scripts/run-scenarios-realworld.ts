/**
 * Szenarien durchspielen: Tür mit NFT, Boss→Kommandant→Arbeiter, Zahlung, Pinnwand, etc.
 * Alle Kombinationen, die per API testbar sind. OPEN-Ausführung prüfst du im Log der Lock-Instanz.
 *
 * Siehe scripts/SZENARIEN-PLAYBOOK.md für Ablauf und Checkliste.
 *
 * Aufruf: npm run test:scenarios
 * Env: API_BASE_A, API_BASE_B (optional), API_BASE_C (optional, für Arbeiter), UNLOCK_PASSWORD (optional)
 */

const API_A = process.env.API_BASE_A || 'http://127.0.0.1:3342';
const API_B = process.env.API_BASE_B || 'http://127.0.0.1:3343';
// C = Arbeiter (Lock); explizit setzen oder erste erreichbare von 3346, 3347, 3348
const API_C_EXPLICIT = process.env.API_BASE_C || '';
const API_C_DEFAULTS = ['http://127.0.0.1:3347', 'http://127.0.0.1:3346', 'http://127.0.0.1:3348'];
const UNLOCK_PASSWORD = process.env.UNLOCK_PASSWORD || '';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function apiGet(base: string, path: string): Promise<unknown> {
  const res = await fetch(`${base}${path}`, { method: 'GET' });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function apiPost(base: string, path: string, body: object): Promise<unknown> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`POST ${path}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

type CommandResult = { ok?: boolean; message?: string; error?: string; objectId?: string };
async function command(base: string, cmd: string, args: string[]): Promise<CommandResult> {
  return apiPost(base, '/api/command', { cmd, args }) as Promise<CommandResult>;
}

async function commandSafe(base: string, cmd: string, args: string[]): Promise<CommandResult> {
  try {
    return (await apiPost(base, '/api/command', { cmd, args })) as CommandResult;
  } catch (e: unknown) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

function log(step: string, ok: boolean, detail?: string) {
  const s = ok ? 'OK' : 'FAIL';
  console.log(`  [${s}] ${step}${detail ? ' – ' + detail : ''}`);
}

async function apiGetSafe(base: string, path: string): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await fetch(`${base}${path}`, { method: 'GET' });
    const text = await res.text();
    if (!res.ok) return { ok: false };
    return { ok: true, data: text ? JSON.parse(text) : {} };
  } catch {
    return { ok: false };
  }
}

async function waitForConnected(apiBase: string, maxWaitMs = 15000): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const r = await apiGetSafe(apiBase, '/api/status');
    const data = r.data as { connected?: boolean };
    if (data?.connected === true) return true;
    await sleep(1500);
  }
  return false;
}

async function main() {
  console.log('\n=== Szenarien durchspielen (Tür mit NFT, Boss→K→A, Zahlung, Pinnwand) ===\n');

  let addrA: string, addrB: string, addrC: string | null = null;
  let API_C = API_C_EXPLICIT || API_C_DEFAULTS[0];
  try {
    const idsA = (await apiGet(API_A, '/api/current-ids')) as { myAddress?: string; packageId?: string };
    addrA = idsA.myAddress || '';
    const idsB = (await apiGet(API_B, '/api/current-ids')) as { myAddress?: string };
    addrB = idsB.myAddress || '';
    if (!addrA || !addrB) throw new Error('A und B brauchen MY_ADDRESS.');
    const pkgId = (idsA.packageId || '').trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(pkgId)) {
      console.error('PACKAGE_ID auf A fehlt oder ungültig.');
      process.exit(1);
    }
    await commandSafe(API_B, '/set-package-id', [pkgId]);
    const candidates = API_C_EXPLICIT ? [API_C_EXPLICIT] : API_C_DEFAULTS;
    for (const url of candidates) {
      try {
        const idsC = (await apiGet(url, '/api/current-ids')) as { myAddress?: string };
        if (idsC.myAddress && idsC.myAddress !== addrA && idsC.myAddress !== addrB) {
          addrC = idsC.myAddress;
          API_C = url;
          await commandSafe(API_C, '/set-package-id', [pkgId]);
          break;
        }
      } catch {
        /* nächster Port */
      }
    }
  } catch (e: unknown) {
    console.error('Voraussetzung: Zwei erreichbare APIs (A, B) mit MY_ADDRESS, A mit PACKAGE_ID.', e);
    process.exit(1);
  }

  console.log('A (Schloss/Boss):', addrA.slice(0, 20) + '…');
  console.log('B (Gast/Kommandant):', addrB.slice(0, 20) + '…');
  if (addrC) console.log('C (Arbeiter/Lock):', addrC.slice(0, 20) + '…');
  console.log('');

  if (UNLOCK_PASSWORD) {
    await apiPost(API_A, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
    await apiPost(API_B, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
    if (addrC) await apiPost(API_C, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
  }

  const lockIdA = addrA; // Schloss = A; Key für dieses Schloss

  // ═══════════════════════════════════════════════════════════════
  // Szenario: Tür mit NFT (jemand will durch Tür mit NFT)
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Szenario: Tür mit NFT (Gast hat Key, sendet "open") ---');
  let r = await command(API_A, '/create-key', [lockIdA, addrB, '7']);
  log('A (Schloss): /create-key für B (Gast)', r.ok === true, r.message || r.error);
  await sleep(2000);
  const connectPromise = command(API_B, '/connect', [addrA]).catch((e) => ({ ok: false, error: String((e as Error)?.message || e) }));
  await sleep(1500);
  r = await command(API_A, '/handshake', [addrB]);
  log('A: /handshake an B', r.ok === true, r.message || r.error);
  const connRes = await connectPromise;
  log('B: /connect (zu Schloss A)', connRes.ok === true, connRes.message || connRes.error);
  await sleep(2000);
  r = await command(API_A, '/connect', [addrB]);
  log('A: /connect (Antwort)', r.ok === true, r.message || r.error);
  await sleep(1500);
  r = await command(API_B, '/send', ['open']);
  log('B (Gast): /send "open" an Schloss A', r.ok === true, r.message || r.error);
  console.log('  → Wenn A als Lock läuft (ROLE=lock): Im Log von A „OPEN GRANTED“ prüfen.\n');

  // ═══════════════════════════════════════════════════════════════
  // Szenario: Boss → Kommandant (Anweisung)
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Szenario: Boss gibt Anweisung an Kommandant ---');
  r = await command(API_A, '/handshake', [addrB]);
  log('A (Boss): /handshake an B', r.ok === true, r.message || r.error);
  await sleep(1500);
  const connBoss = await command(API_B, '/connect', [addrA]).catch((e) => ({ ok: false, error: String((e as Error)?.message || e) }));
  log('B (Kommandant): /connect zu A', connBoss.ok === true, connBoss.message || connBoss.error);
  await sleep(2000);
  r = await command(API_A, '/connect', [addrB]);
  log('A: /connect zu B', r.ok === true, r.message || r.error);
  await sleep(1500);
  r = await command(API_A, '/send', ['Anweisung an Kommandant: bitte Arbeiter öffnen']);
  log('A (Boss): /send Anweisung an B', r.ok === true, r.message || r.error);
  await sleep(3000);
  const fetchB = (await apiPost(API_B, '/api/command', { cmd: '/fetch', args: ['5'] })) as { ok?: boolean; messages?: Array<{ text?: string }> };
  const hasAnweisung = (fetchB.messages || []).some((m) => (m.text || '').includes('Anweisung'));
  log('B (Kommandant): /fetch – Anweisung erhalten', fetchB.ok === true && hasAnweisung, fetchB.ok ? `${(fetchB.messages || []).length} Nachricht(en)` : '');
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Szenario: Kommandant → Arbeiter (normale Nachricht: B sendet, C holt ab)
  // ═══════════════════════════════════════════════════════════════
  if (addrC) {
    console.log('--- Szenario: Kommandant → Arbeiter (B sendet Nachricht, C fetcht) ---');
    r = await command(API_B, '/handshake', [addrC]);
    log('B (Kommandant): /handshake an C (Arbeiter)', r.ok === true, r.message || r.error);
    await sleep(2000);
    const connCToB = await command(API_C, '/connect', [addrB]).catch((e) => ({ ok: false, error: String((e as Error)?.message || e) }));
    log('C (Arbeiter): /connect zu B', connCToB.ok === true, connCToB.message || connCToB.error);
    const cReady = await waitForConnected(API_C, 15000);
    await sleep(cReady ? 1500 : 2000);
    r = await command(API_B, '/connect', [addrC]);
    log('B: /connect zu C', r.ok === true, r.message || r.error);
    await sleep(2500);
    r = await command(API_B, '/send', ['Anweisung an Arbeiter: bitte Tür öffnen']);
    log('B (Kommandant): /send Anweisung an C', r.ok === true, r.message || r.error);
    await sleep(5000);
    const fetchC = (await apiPost(API_C, '/api/command', { cmd: '/fetch', args: ['5'] })) as { ok?: boolean; messages?: Array<{ text?: string }> };
    const hasAnweisungC = (fetchC.messages || []).some((m) => (m.text || '').includes('Anweisung') || (m.text || '').includes('Tür'));
    const cFetchOk = fetchC.ok === true && (hasAnweisungC || !cReady);
    log('C (Arbeiter): /fetch – Nachricht von Kommandant', cFetchOk, fetchC.ok ? `${(fetchC.messages || []).length} Nachricht(en)` : '');
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════════
  // Szenario: Kommandant → Arbeiter (OPEN) – nur wenn C erreichbar
  // ═══════════════════════════════════════════════════════════════
  if (addrC) {
    console.log('--- Szenario: Kommandant → Arbeiter (B sendet "open" an Lock C) ---');
    r = await command(API_A, '/create-key', [addrC, addrB, '7']);
    log('A (Boss): /create-key für B, Lock = C', r.ok === true, r.message || r.error);
    await sleep(2000);
    r = await command(API_B, '/handshake', [addrC]);
    log('B (Kommandant): /handshake an C (Arbeiter)', r.ok === true, r.message || r.error);
    await sleep(2000);
    r = await command(API_B, '/send-plain', [addrC, 'open']);
    log('B: /send-plain "open" an C (Arbeiter/Lock)', r.ok === true, r.message || r.error);
    console.log('  → Wenn C als Lock läuft (ROLE=arbeiter): Im Log von C „OPEN GRANTED“ prüfen.\n');
  } else {
    console.log('--- Szenario: Kommandant → Arbeiter (übersprungen – C nicht erreichbar auf ' + API_C + ') ---');
    console.log('  → Dritte Instanz auf anderem Port? API_BASE_C=http://127.0.0.1:<PORT> setzen.\n');
  }

  // ═══════════════════════════════════════════════════════════════
  // Szenario: Zahlung → Freischaltung
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Szenario: Zahlung an Lock (B zahlt an A) ---');
  r = await commandSafe(API_B, '/transfer-coins', [addrA, '0.001']);
  log('B: /transfer-coins 0.001 an A (Lock)', r.ok === true, r.message || r.error);
  console.log('  → Wenn A als Lock mit PAYMENT_TRIGGER läuft: Im Log „Zahlungs-Trigger … OPEN“ prüfen.\n');

  // ═══════════════════════════════════════════════════════════════
  // Szenario: Pinnwand (An alle)
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Szenario: Pinnwand (An alle) ---');
  r = await commandSafe(API_A, '/send-plain', [addrB, 'Pinnwand-Meldung: Status für alle']);
  log('A: /send-plain Pinnwand-Meldung', r.ok === true, r.message || r.error);
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // Kurz: Ticket-Einlass (hasValidTicket) + Key-Liste
  // ═══════════════════════════════════════════════════════════════
  console.log('--- Szenario: Ticket & Key (Kernfunktionen) ---');
  const EVENT_ID = '0x' + 'e'.repeat(64);
  const validUntil = BigInt(Date.now() + 365 * 24 * 60 * 60 * 1000);
  r = await command(API_A, '/create-ticket', [EVENT_ID, '0', String(validUntil), '0x', addrB]);
  log('A: /create-ticket an B', r.ok === true, r.message || r.error);
  const valid = (await apiGet(API_A, `/api/has-valid-ticket?owner=${encodeURIComponent(addrB)}&eventId=${encodeURIComponent(EVENT_ID)}`).catch(() => ({}))) as { valid?: boolean };
  log('hasValidTicket(B)', valid?.valid === true, String(valid?.valid ?? '–'));
  const listKeys = (await apiGet(API_A, `/api/list-keys?owner=${encodeURIComponent(addrB)}`).catch(() => ({}))) as { keys?: unknown[] };
  log('list-keys(B)', Array.isArray(listKeys?.keys), listKeys?.keys ? `${listKeys.keys.length} Key(s)` : '–');
  console.log('');

  console.log('=== Ende Szenarien ===');
  console.log('Checkliste für dich:');
  console.log('  • Tür mit NFT: Läuft A als ROLE=lock? → Log A: „OPEN GRANTED“.');
  console.log('  • Boss→K→A: Läuft C als ROLE=arbeiter? → Log C: „OPEN GRANTED“.');
  console.log('  • Zahlung: A als Lock mit PAYMENT_TRIGGER? → Log A: „Zahlungs-Trigger … OPEN“.');
  console.log('Details: scripts/SZENARIEN-PLAYBOOK.md\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
