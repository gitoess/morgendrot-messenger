/**
 * Vollständiger Test: Ticket- und AccessKey-Lebenszyklus mit 2 Wallets.
 * Voraussetzung: Zwei Morgendrot-Instanzen laufen (z. B. API 3342 = Wallet A, 3343 = Wallet B).
 * Setze API_BASE_A und API_BASE_B (URL inkl. Port) oder nutze Defaults.
 *
 * Ablauf:
 * - Ticket: A erstellt Ticket für B → B listet auf → hasValidTicket → B nutzt (Einlass) → B listet (used)
 *   → A erstellt Ticket 2 für B → B verkauft weiter an A (transfer) → A storniert (emergency-purge + purge)
 * - AccessKey: A (Lock) erstellt Key für B → B listet → B übergibt an A (transfer) → A löscht (purge)
 *   Optional: A erstellt Key für B → B emergency-purge-key → B purge-key (Rebate)
 */
const API_A = process.env.API_BASE_A || 'http://127.0.0.1:3342';
const API_B = process.env.API_BASE_B || 'http://127.0.0.1:3343';
/** Ein-Wallet-Modus erzwingen (nur A, A=B): Ticket/Key für sich selbst, list sofort sichtbar. */
const FORCE_SINGLE_WALLET = process.env.FORCE_SINGLE_WALLET === '1' || process.env.FORCE_SINGLE_WALLET === 'true';

const EVENT_ID = '0x' + 'e'.repeat(64);
const LOCK_ID = '0x' + 'd'.repeat(64);

const now = Date.now();
const validFromMs = 0;
const validUntilMs = BigInt(now + 365 * 24 * 60 * 60 * 1000);

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

async function command(base: string, cmd: string, args: string[]): Promise<{ ok?: boolean; message?: string; error?: string }> {
  return apiPost(base, '/api/command', { cmd, args }) as Promise<{ ok?: boolean; message?: string; error?: string }>;
}

function log(step: string, ok: boolean, detail?: string) {
  const s = ok ? 'OK' : 'FAIL';
  console.log(`  [${s}] ${step}${detail ? ' – ' + detail : ''}`);
}

async function main() {
  console.log('=== Ticket- & AccessKey-Flow (2 Wallets) ===\n');
  console.log('API A:', API_A, '| API B:', API_B);
  console.log('Event-ID:', EVENT_ID.slice(0, 18) + '…');
  console.log('Lock-ID:', LOCK_ID.slice(0, 18) + '…\n');

  let addrA: string, addrB: string;
  let useOnlyA = false;
  try {
    const idsA = (await apiGet(API_A, '/api/current-ids')) as { myAddress?: string; packageId?: string };
    addrA = idsA.myAddress || '';
    const pkgId = (idsA.packageId || '').trim();
    if (!addrA) throw new Error('Adresse A fehlt (current-ids)');
    if (!/^0x[a-fA-F0-9]{64}$/.test(pkgId)) {
      console.error('PACKAGE_ID ist keine gültige 0x+64-Hex-ID (aktuell: "' + pkgId + '"). Bitte deployen (z. B. /api/deploy-package) oder in .env setzen.');
      process.exit(1);
    }
    if (FORCE_SINGLE_WALLET) {
      addrB = addrA;
      useOnlyA = true;
      console.log('Hinweis: FORCE_SINGLE_WALLET=1 – Ein-Wallet-Modus (A=B), Ticket/Key für sich selbst, list sofort sichtbar.\n');
    } else {
      try {
        const idsB = (await apiGet(API_B, '/api/current-ids')) as { myAddress?: string };
        addrB = idsB.myAddress || '';
        if (!addrB) addrB = addrA;
      } catch {
        addrB = addrA;
        useOnlyA = true;
        console.log('Hinweis: Nur eine Instanz erreichbar – gleiche Adresse für A und B (Ein-Wallet-Modus).\n');
      }
      if (!addrB) addrB = addrA;
    }
    console.log('Wallet A:', addrA.slice(0, 18) + '…');
    console.log('Wallet B:', addrB.slice(0, 18) + '…' + (useOnlyA ? ' (wie A)' : '') + '\n');
  } catch (e) {
    console.error('Voraussetzung: Mindestens API A erreichbar und current-ids liefern myAddress.', e);
    process.exit(1);
  }

  const apiB = useOnlyA ? API_A : API_B;

  // Wenn 2 Instanzen: PACKAGE_ID auf B setzen (Deploy war ggf. nur auf A)
  const idsForPkg = (await apiGet(API_A, '/api/current-ids')) as { packageId?: string };
  const pkgIdForSync = (idsForPkg.packageId || '').trim();
  if (!useOnlyA && /^0x[a-fA-F0-9]{64}$/.test(pkgIdForSync)) {
    const setPkg = await command(apiB, '/set-package-id', [pkgIdForSync]);
    if (setPkg.ok) console.log('   PACKAGE_ID auf Instanz B gesetzt.\n');
  }

  // --- TICKET-FLOW ---
  console.log('--- Ticket-Flow ---');

  // 1) A erstellt Ticket für B
  let r = await command(API_A, '/create-ticket', [
    EVENT_ID,
    String(validFromMs),
    String(validUntilMs),
    '0x',
    addrB,
  ]);
  log('1. A: create-ticket für B', r.ok === true, r.message || r.error);
  if (!r.ok) {
    console.log('   Abbruch Ticket-Flow:', r.error || r.message);
  } else {
    // Abfrage mit PACKAGE_ID von A; Chain-Indizierung kann 5–30 s dauern
    let listB: { tickets?: Array<{ objectId: string; eventId: string; used: boolean }> } = { tickets: [] };
    for (let i = 0; i < 12; i++) {
      await new Promise((x) => setTimeout(x, i === 0 ? 5000 : 3000));
      listB = (await apiGet(API_A, `/api/list-tickets?owner=${encodeURIComponent(addrB)}`)) as typeof listB;
      if ((listB.tickets?.length ?? 0) > 0) break;
    }
    const ticketsB = listB.tickets || [];
    const ticket1 = ticketsB.find((t) => t.eventId === EVENT_ID && !t.used) || ticketsB[0];
    log('2. B: list-tickets', Array.isArray(listB.tickets), `${ticketsB.length} Ticket(s)`);
    if (!ticket1?.objectId) {
      console.log('   Kein Ticket-Objekt für B gefunden (evtl. TX noch nicht sichtbar oder Instanz B braucht dieselbe PACKAGE_ID wie A).');
    } else {
      // 3) hasValidTicket(B, eventId)
      const valid = (await apiGet(API_A, `/api/has-valid-ticket?owner=${encodeURIComponent(addrB)}&eventId=${encodeURIComponent(EVENT_ID)}`)) as { valid?: boolean };
      log('3. hasValidTicket(B, eventId)', valid.valid === true, String(valid.valid));

      // 4) B: use-ticket (Einlass)
      r = await command(apiB, '/use-ticket', [ticket1.objectId, EVENT_ID]);
      log('4. B: use-ticket (Einlass)', r.ok === true, r.message || r.error);
      await new Promise((x) => setTimeout(x, 2000));

      // 5) B: list-tickets (sollte used=true haben)
      const listB2 = (await apiGet(API_A, `/api/list-tickets?owner=${encodeURIComponent(addrB)}`)) as { tickets?: Array<{ objectId: string; used: boolean }> };
      const usedTicket = (listB2.tickets || []).find((t) => t.objectId === ticket1.objectId);
      log('5. B: list-tickets nach Nutzung (used)', usedTicket?.used === true, usedTicket ? 'used=true' : 'nicht gefunden');

      // 6) A erstellt zweites Ticket für B („zweites Konzert“)
      r = await command(API_A, '/create-ticket', [EVENT_ID, String(validFromMs), String(validUntilMs), '0x', addrB]);
      log('6. A: create-ticket 2 für B', r.ok === true, r.message || r.error);
      await new Promise((x) => setTimeout(x, 3000));

      const listB3 = (await apiGet(API_A, `/api/list-tickets?owner=${encodeURIComponent(addrB)}`)) as { tickets?: Array<{ objectId: string; used: boolean }> };
      const ticket2 = (listB3.tickets || []).find((t) => !t.used);
      if (ticket2?.objectId) {
        // 7) B: transfer-ticket an A (Weiterverkauf)
        r = await command(apiB, '/transfer-ticket', [ticket2.objectId, addrA]);
        log('7. B: transfer-ticket an A (Verkauf zurück)', r.ok === true, r.message || r.error);
        await new Promise((x) => setTimeout(x, 2000));

        // 8) A: list-tickets (sollte das Ticket haben)
        const listA = (await apiGet(API_A, `/api/list-tickets?owner=${encodeURIComponent(addrA)}`)) as { tickets?: unknown[] };
        log('8. A: list-tickets (nach Transfer)', Array.isArray(listA.tickets), `${(listA.tickets || []).length} Ticket(s)`);

        const ticketAtA = (listA.tickets as Array<{ objectId: string }>)?.find((t) => t.objectId === ticket2.objectId);
        if (ticketAtA) {
          // 9) A: emergency-purge-ticket
          r = await command(API_A, '/emergency-purge-ticket', [ticketAtA.objectId]);
          log('9. A: emergency-purge-ticket', r.ok === true, r.message || r.error);
          await new Promise((x) => setTimeout(x, 2000));
          // 10) A: purge-ticket (Stornierung)
          r = await command(API_A, '/purge-ticket', [ticketAtA.objectId]);
          log('10. A: purge-ticket (Stornierung)', r.ok === true, r.message || r.error);
        }
      } else {
        console.log('   Kein zweites (ungenutztes) Ticket für B – Schritt 7–10 übersprungen.');
      }
    }
  }

  // --- ACCESSKEY-FLOW ---
  console.log('\n--- AccessKey-Flow ---');

  // 1) A (Lock) erstellt AccessKey für B
  r = await command(API_A, '/create-key', [LOCK_ID, addrB, '7']);
  log('1. A: create-key (Lock) für B, TTL 7 Tage', r.ok === true, r.message || r.error);
  if (!r.ok) {
    console.log('   Abbruch AccessKey-Flow:', r.error || r.message);
  } else {
    let keysB: { keys?: Array<{ objectId: string; lockId: string }> } = { keys: [] };
    for (let i = 0; i < 12; i++) {
      await new Promise((x) => setTimeout(x, i === 0 ? 5000 : 3000));
      keysB = (await apiGet(API_A, `/api/list-keys?owner=${encodeURIComponent(addrB)}`)) as typeof keysB;
      if ((keysB.keys?.length ?? 0) > 0) break;
    }
    const keyList = keysB.keys || [];
    const key1 = keyList.find((k) => k.lockId === LOCK_ID) || keyList[0];
    log('2. B: list-keys', Array.isArray(keysB.keys), `${keyList.length} Key(s)`);
    if (!key1?.objectId) {
      console.log('   Kein AccessKey für B gefunden (evtl. Instanz B braucht dieselbe PACKAGE_ID wie A).');
    } else {
      // 3) B: transfer-key an A (Weitergabe)
      r = await command(apiB, '/transfer-key', [key1.objectId, addrA]);
      log('3. B: transfer-key an A', r.ok === true, r.message || r.error);
      await new Promise((x) => setTimeout(x, 2000));

      const keysA = (await apiGet(API_A, `/api/list-keys?owner=${encodeURIComponent(addrA)}`)) as { keys?: Array<{ objectId: string }> };
      const keyAtA = (keysA.keys || []).find((k) => k.objectId === key1.objectId);
      if (keyAtA) {
        // 4) A: purge-key (Key zurück, Rebate)
        r = await command(API_A, '/purge-key', [keyAtA.objectId]);
        log('4. A: purge-key (Rebate)', r.ok === true, r.message || r.error);
      }

      // Optional: Zweiter Key – B macht emergency-purge + purge (Selbst-Stornierung)
      r = await command(API_A, '/create-key', [LOCK_ID, addrB, '1']);
      log('5. A: create-key 2 für B', r.ok === true, r.message || r.error);
      await new Promise((x) => setTimeout(x, 3000));
      const keysB2 = (await apiGet(apiB, `/api/list-keys?owner=${encodeURIComponent(addrB)}`)) as { keys?: Array<{ objectId: string; lockId: string }> };
      const key2 = (keysB2.keys || []).find((k) => k.lockId === LOCK_ID);
      if (key2?.objectId) {
        r = await command(apiB, '/emergency-purge-key', [key2.objectId]);
        log('6. B: emergency-purge-key', r.ok === true, r.message || r.error);
        await new Promise((x) => setTimeout(x, 2000));
        r = await command(apiB, '/purge-key', [key2.objectId]);
        log('7. B: purge-key (Rebate nach Notfall-Flag)', r.ok === true, r.message || r.error);
      }
    }
  }

  console.log('\n=== Ende Ticket- & AccessKey-Flow ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
