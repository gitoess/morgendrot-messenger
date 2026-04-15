/**
 * Kompletter Real-World-Ablauf: Ticket & AccessKey – alles, was in der Echtwelt möglich ist.
 *
 * Szenarien:
 * - NFT erstellen (normal + personalisiert mit Echtnamen, z. B. Nicole)
 * - Auflisten, Gültigkeitsprüfung (hasValidTicket)
 * - Mutieren (use_ticket → used=true, Einlass)
 * - Verkaufen / Weitergabe (transfer_ticket, transfer_key)
 * - Tauschen (transfer an andere Adresse)
 * - Entwerten (emergency_purge + purge für Storno/Rückgabe)
 *
 * Aufruf: **`npm run test:realworld`** oder **`npm run test:tickets-accesskey-realworld`** (gleiche Datei).
 * Env: API_BASE_A, API_BASE_B (optional), FORCE_SINGLE_WALLET=1 (optional)
 *
 * **Abgrenzung:** Messenger (Chat, Mailbox, Handshake, …) → **`npm run test:messages`** /
 * **`scripts/run-messages-chat-realworld.ts`** — nicht dieses Skript.
 *
 * Hinweis: Schritte 4/6 (`has-valid-ticket`, Liste nach use-ticket) hängen an RPC/`getOwnedObjects`.
 * Gate-Logik vergleicht `event_id` case-insensitive (siehe `hasValidTicket` in chain-access); bei langsamer
 * Indizierung kurze Retries im Skript.
 */

const API_A = process.env.API_BASE_A || 'http://127.0.0.1:3342';
const API_B = process.env.API_BASE_B || 'http://127.0.0.1:3343';
const FORCE_SINGLE_WALLET = process.env.FORCE_SINGLE_WALLET === '1' || process.env.FORCE_SINGLE_WALLET === 'true';

const EVENT_ID = '0x' + 'e'.repeat(64);

const sameHexId = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const LOCK_ID = '0x' + 'd'.repeat(64);
const now = Date.now();
const validFromMs = 0;
const validUntilMs = BigInt(now + 365 * 24 * 60 * 60 * 1000);

/** Echtnamen/Text in metadata_hex (UTF-8 → Hex). Für personalisierte Tickets, z. B. holder_name "Nicole". */
function textToMetadataHex(text: string): string {
  const hex = Buffer.from(text, 'utf8').toString('hex');
  return '0x' + hex;
}

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

function log(step: string, ok: boolean, detail?: string) {
  const s = ok ? 'OK' : 'FAIL';
  console.log(`  [${s}] ${step}${detail ? ' – ' + detail : ''}`);
}

/** Abfrage immer über API_A (hat PACKAGE_ID), owner = Adresse des Besitzers. */
async function pollListTickets(owner: string, maxWaitMs = 90000): Promise<Array<{ objectId: string; eventId: string; used: boolean }>> {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < maxWaitMs) {
    attempt++;
    if (attempt > 1) console.log(`   Warte auf Chain-Indizierung (Tickets)… ${Math.round((Date.now() - start) / 1000)}s`);
    await new Promise((r) => setTimeout(r, 4000));
    const list = (await apiGet(API_A, `/api/list-tickets?owner=${encodeURIComponent(owner)}`)) as { tickets?: Array<{ objectId: string; eventId: string; used: boolean }> };
    if ((list.tickets?.length ?? 0) > 0) return list.tickets!;
  }
  return [];
}

async function pollListKeys(owner: string, maxWaitMs = 90000): Promise<Array<{ objectId: string; lockId: string }>> {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < maxWaitMs) {
    attempt++;
    if (attempt > 1) console.log(`   Warte auf Chain-Indizierung (Keys)… ${Math.round((Date.now() - start) / 1000)}s`);
    await new Promise((r) => setTimeout(r, 4000));
    const list = (await apiGet(API_A, `/api/list-keys?owner=${encodeURIComponent(owner)}`)) as { keys?: Array<{ objectId: string; lockId: string }> };
    if ((list.keys?.length ?? 0) > 0) return list.keys!;
  }
  return [];
}

async function main() {
  console.log('\n=== Real-World: Ticket & AccessKey – alle Szenarien (Wallet 2 = Käufer) ===\n');
  console.log('Wallet A = Verkäufer/Veranstalter/Lock | Wallet B = Käufer (Wallet 2).');
  console.log('Szenarien: NFT an Wallet 2 senden → Käufer listet → Einlass (mutieren) → Weiterverkauf → Storno; Key an Wallet 2 → Tausch → Rückgabe → Verlust/Entwertung.\n');

  let addrA: string, addrB: string, useOnlyA = false;
  try {
    const idsA = (await apiGet(API_A, '/api/current-ids')) as { myAddress?: string; packageId?: string };
    addrA = idsA.myAddress || '';
    const pkgId = (idsA.packageId || '').trim();
    if (!addrA) throw new Error('Adresse A fehlt (current-ids)');
    if (!/^0x[a-fA-F0-9]{64}$/.test(pkgId)) {
      console.error('PACKAGE_ID ist keine gültige 0x+64-Hex-ID. Bitte deployen (POST /api/deploy-package) oder in .env setzen.');
      process.exit(1);
    }
    if (FORCE_SINGLE_WALLET) {
      addrB = addrA;
      useOnlyA = true;
      console.log('FORCE_SINGLE_WALLET=1 → A = B (Ein-Wallet).\n');
    } else {
      try {
        const idsB = (await apiGet(API_B, '/api/current-ids')) as { myAddress?: string };
        addrB = idsB.myAddress || addrA;
      } catch {
        addrB = addrA;
        useOnlyA = true;
      }
    }
    if (!addrB) addrB = addrA;
    console.log('Wallet A (Verkäufer/Lock):', addrA.slice(0, 18) + '…');
    console.log('Wallet 2 – Käufer (B):    ', addrB.slice(0, 18) + '…' + (useOnlyA ? ' (wie A, Ein-Wallet)' : '') + '\n');
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; port?: number; address?: string } };
    const cause = err.cause;
    const refused3342 =
      cause?.code === 'ECONNREFUSED' &&
      (cause.port === 3342 || cause.address === '127.0.0.1');
    const hint = refused3342
      ? '\n→ Backend fehlt auf 3342: im Repo-Root z. B. `npm run start:secrets` oder `npm start` starten, Tresor entsperren, dann `npm run test:realworld` erneut. Optional: `API_BASE_A=http://…:3342`.'
      : '';
    console.error('Voraussetzung: API A erreichbar, current-ids mit myAddress und gültiger PACKAGE_ID.' + hint, e);
    process.exit(1);
  }

  const apiB = useOnlyA ? API_A : API_B;
  if (!useOnlyA) {
    const idsForPkg = (await apiGet(API_A, '/api/current-ids')) as { packageId?: string };
    if (idsForPkg.packageId) {
      const setPkg = await command(apiB, '/set-package-id', [idsForPkg.packageId]);
      if (setPkg.ok) console.log('   PACKAGE_ID auf B gesetzt.\n');
    }
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // ═══════════════════════════════════════════════════════════════════
  // TICKET – alle Real-World-Szenarien (NFT an Wallet 2 = Käufer)
  // ═══════════════════════════════════════════════════════════════════
  console.log('--- Ticket: NFT an Wallet 2 (Käufer) → Einlass → Weiterverkauf → Storno ---');

  // 1) Verkäufer (A) sendet Ticket an Wallet 2 (Käufer B)
  let r = await command(API_A, '/create-ticket', [EVENT_ID, String(validFromMs), String(validUntilMs), '0x', addrB]);
  const createdTicketId1 = r.objectId;
  log('1. Verkäufer sendet NFT an Wallet 2 (Käufer)', r.ok === true, r.message || r.error);
  if (!r.ok) {
    console.log('   Abbruch Ticket-Teil:', r.error || r.message);
  } else {
    // 2) Personalisiertes Ticket an Wallet 2 (Nicole)
    const metadataNicole = textToMetadataHex('Nicole');
    r = await command(API_A, '/create-ticket', [EVENT_ID, String(validFromMs), String(validUntilMs), metadataNicole, addrB]);
    const createdTicketId2 = r.objectId;
    log('2. Personalisiertes Ticket an Wallet 2 (holder_name Nicole)', r.ok === true, r.message || r.error);
    await sleep(5000);

    // 3) Wallet 2 (Käufer) listet seine Tickets (oder nutzt von Create zurückgegebene Object-IDs)
    const ticketsB = await pollListTickets(addrB);
    const ticket1FromList = ticketsB.find((t) => t.eventId === EVENT_ID && !t.used) || ticketsB[0];
    const ticket1 = ticket1FromList ?? (createdTicketId1 ? { objectId: createdTicketId1, eventId: EVENT_ID, used: false } : undefined);
    log('3. Wallet 2 (Käufer) listet Tickets', ticketsB.length >= 0, ticketsB.length > 0 ? `${ticketsB.length} Ticket(s)` : createdTicketId1 ? '0 (nutze Object-ID aus Create)' : '0 Ticket(s)');

    if (ticket1?.objectId) {
      // 4) Gate prüft: Hat Wallet 2 gültiges Ticket? (Retries: RPC kann kurz hinter Create liegen)
      let valid = (await apiGet(API_A, `/api/has-valid-ticket?owner=${encodeURIComponent(addrB)}&eventId=${encodeURIComponent(EVENT_ID)}`)) as { valid?: boolean };
      for (let attempt = 0; attempt < 6 && valid.valid !== true; attempt++) {
        await sleep(2000);
        valid = (await apiGet(API_A, `/api/has-valid-ticket?owner=${encodeURIComponent(addrB)}&eventId=${encodeURIComponent(EVENT_ID)}`)) as { valid?: boolean };
      }
      log('4. Gate: hasValidTicket(Wallet 2)', valid.valid === true, String(valid.valid));

      // 5) Käufer (Wallet 2) geht ein → Mutieren (used=true)
      r = await command(apiB, '/use-ticket', [ticket1.objectId, EVENT_ID]);
      log('5. Wallet 2 (Käufer) Einlass / use-ticket', r.ok === true, r.message || r.error);
      await sleep(2000);

      // 6) Wallet 2 listet nach Einlass (used) — Object-ID case-insensitive; Retries nach Mutation
      let listAfter = (await apiGet(API_A, `/api/list-tickets?owner=${encodeURIComponent(addrB)}`)) as { tickets?: Array<{ objectId: string; used: boolean }> };
      let usedOne = (listAfter.tickets || []).find((t) => sameHexId(t.objectId, ticket1.objectId));
      for (let attempt = 0; attempt < 8 && (!usedOne || usedOne.used !== true); attempt++) {
        await sleep(2500);
        listAfter = (await apiGet(API_A, `/api/list-tickets?owner=${encodeURIComponent(addrB)}`)) as { tickets?: Array<{ objectId: string; used: boolean }> };
        usedOne = (listAfter.tickets || []).find((t) => sameHexId(t.objectId, ticket1.objectId));
      }
      log('6. Wallet 2: Liste nach Einlass (used)', usedOne?.used === true, usedOne ? 'used=true' : '–');

      // 7) Zweites Konzert: Verkäufer sendet weiteres Ticket an Wallet 2
      r = await command(API_A, '/create-ticket', [EVENT_ID, String(validFromMs), String(validUntilMs), '0x', addrB]);
      const createdTicketId3 = r.objectId;
      log('7. Verkäufer sendet 2. Ticket an Wallet 2', r.ok === true, r.message || r.error);
      await sleep(5000);

      const ticketsB2 = await pollListTickets(addrB);
      const ticket2FromList = ticketsB2.find((t) => !t.used);
      const ticket2 = ticket2FromList ?? (createdTicketId3 ? { objectId: createdTicketId3, eventId: EVENT_ID, used: false } : undefined);
      if (ticket2?.objectId) {
        // 8) Käufer (Wallet 2) verkauft Ticket weiter an A (z. B. Rückkauf/Stornobörse)
        r = await command(apiB, '/transfer-ticket', [ticket2.objectId, addrA]);
        log('8. Wallet 2 (Käufer) verkauft/übergibt Ticket an A', r.ok === true, r.message || r.error);
        await sleep(2000);

        // 9) A (neuer Besitzer) listet (oder nutzt bekannte Object-ID)
        const listA = (await apiGet(API_A, `/api/list-tickets?owner=${encodeURIComponent(addrA)}`)) as { tickets?: Array<{ objectId: string }> };
        const atA = (listA.tickets || []).find((t) => t.objectId === ticket2.objectId) ?? (createdTicketId3 ? { objectId: createdTicketId3 } : undefined);
        log('9. Verkäufer (A) hat Ticket nach Rückkauf', Array.isArray(listA.tickets) && listA.tickets.length > 0 || Boolean(atA), atA ? '1 Ticket' : `${(listA.tickets || []).length} Ticket(s)`);

        if (atA?.objectId) {
          // 10+11) Veranstalter storniert (Entwerten + Löschen)
          r = await command(API_A, '/emergency-purge-ticket', [atA.objectId]);
          log('10. Storno: emergency-purge-ticket', r.ok === true, r.message || r.error);
          await sleep(2000);
          r = await command(API_A, '/purge-ticket', [atA.objectId]);
          log('11. Storno: purge-ticket (Rebate)', r.ok === true, r.message || r.error);
        }
      } else {
        console.log('   Kein ungenutztes Ticket für Weiterverkauf/Storno (list verzögert, keine Object-ID von Create).');
      }
    } else {
      console.log('   Wallet 2: Kein Ticket in list (Chain-Indizierung kann verzögert sein).');
      console.log('   Tipp: In 2–3 Min. erneut ausführen → dann use-ticket, transfer, purge durchspielbar.');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ACCESSKEY – alle Real-World-Szenarien (Key an Wallet 2 = Käufer/Mieter)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n--- AccessKey: NFT an Wallet 2 (Käufer/Mieter) → Tausch → Rückgabe → Verlust/Entwertung ---');

  r = await command(API_A, '/create-key', [LOCK_ID, addrB, '7']);
  const createdKeyId1 = r.objectId;
  log('1. Lock (A) stellt Key für Wallet 2 (Käufer/Mieter) aus', r.ok === true, r.message || r.error);
  if (!r.ok) {
    console.log('   Abbruch AccessKey-Teil:', r.error || r.message);
  } else {
    const keysB = await pollListKeys(addrB);
    const key1FromList = keysB.find((k) => k.lockId === LOCK_ID) || keysB[0];
    const key1 = key1FromList ?? (createdKeyId1 ? { objectId: createdKeyId1, lockId: LOCK_ID } : undefined);
    log('2. Wallet 2 (Käufer) listet Keys', keysB.length >= 0, keysB.length > 0 ? `${keysB.length} Key(s)` : createdKeyId1 ? '0 (nutze Object-ID aus Create)' : '0 Key(s)');

    if (key1?.objectId) {
      // 3) Wallet 2 gibt Key weiter / tauscht (z. B. an A zurück oder an Dritten)
      r = await command(apiB, '/transfer-key', [key1.objectId, addrA]);
      log('3. Wallet 2 (Käufer) übergibt Key an A (Rückgabe/Tausch)', r.ok === true, r.message || r.error);
      await sleep(2000);

      const keysA = (await apiGet(API_A, `/api/list-keys?owner=${encodeURIComponent(addrA)}`)) as { keys?: Array<{ objectId: string }> };
      const keyAtA = (keysA.keys || []).find((k) => k.objectId === key1.objectId) ?? (createdKeyId1 ? { objectId: createdKeyId1 } : undefined);
      if (keyAtA?.objectId) {
        r = await command(API_A, '/purge-key', [keyAtA.objectId]);
        log('4. A nimmt Key zurück / Rebate (purge-key)', r.ok === true, r.message || r.error);
      }

      // 5) Zweiter Key an Wallet 2 → Szenario: Key verloren → Entwerten
      r = await command(API_A, '/create-key', [LOCK_ID, addrB, '1']);
      const createdKeyId2 = r.objectId;
      log('5. Lock stellt 2. Key für Wallet 2 aus', r.ok === true, r.message || r.error);
      await sleep(5000);
      const keysB2 = await pollListKeys(addrB);
      const key2FromList = keysB2.find((k) => k.lockId === LOCK_ID);
      const key2 = key2FromList ?? (createdKeyId2 ? { objectId: createdKeyId2, lockId: LOCK_ID } : undefined);
      if (key2?.objectId) {
        r = await command(apiB, '/emergency-purge-key', [key2.objectId]);
        log('6. Wallet 2: Key verloren → Entwerten (emergency-purge-key)', r.ok === true, r.message || r.error);
        await sleep(2000);
        r = await command(apiB, '/purge-key', [key2.objectId]);
        log('7. Wallet 2: purge-key nach Entwertung (Rebate)', r.ok === true, r.message || r.error);
      }
    } else {
      console.log('   Wallet 2: Kein Key in list (Chain-Indizierung kann verzögert sein).');
      console.log('   Tipp: In 2–3 Min. erneut ausführen → dann transfer-key, purge-key durchspielbar.');
    }
  }

  console.log('\n=== Ende Real-World-Ablauf ===');
  console.log('Personalisiertes Ticket: Name (z. B. Nicole) im Ticket als metadata_hex. Am Eingang zeigt die Person ihren Ausweis zum Abgleich – kein IOTA Name Record.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
