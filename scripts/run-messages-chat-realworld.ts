/**
 * Nachrichten & Chat – alle Real-Life-Szenarien und Optionen durchtesten (2 Instanzen).
 *
 * Deckt ab: Einrichtung, API-Abfragen, optional Geheimnis-Peering (/pairing-*), klassischer
 * Handshake+Connect, verschlüsselt senden/fetch, Sender-Filter, Klartext, Folgeoptionen,
 * optional /vault-save + Prüfung vaultStatus.hasLocal.
 * Optional: Kompaktes Bild: lokal VaultImagePipeline.encodeToPlaintextBlobFitChain + /send-plain an die
 * eigene Adresse (Klartext, kein Handshake). Läuft direkt nach Unlock – unabhängig von API-Version und /connect.
 *
 * **Abgrenzung:** Tickets / AccessKey (andere Kacheln, Event-/Schloss-Flows) sind **`npm run test:realworld`**
 * bzw. **`scripts/run-ticket-accesskey-realworld.ts`** — nicht dieses Messenger-Skript.
 *
 * Voraussetzung: Zwei laufende Morgendrot-Instanzen (z. B. Port 3342 und 3343),
 * beide Wallet entsperrt (in der UI oder so, dass die API-Sitzung entsperrt ist).
 * Env **optional:** UNLOCK_PASSWORD (beide gleich) oder UNLOCK_PASSWORD_A / UNLOCK_PASSWORD_B — nur nötig,
 * wenn `/vault-save` **ohne** vorheriges UI-Unlock am **selben** API-Prozess laufen soll; sonst reicht UI-Unlock:
 * Abschnitt 7 ruft `/vault-save` mit leeren Args auf, dann nutzt der Server **`getWalletPassword()`** aus dem Unlock.
 * Weitere Env: API_BASE_A/B, PAIRING_SECRET (min. 6 Zeichen), SKIP_PEERING=1 (nur klassischer Handshake).
 * Ein-Wallet-Realtest: SINGLE_WALLET=1 → nur API_BASE_A (oder Default 3342), Handshake+Connect an eigene Adresse, /send & /fetch auf derselben API.
 *
 * Aufruf: npm run test:messages  oder  npm run test:messenger
 * Ein-Wallet (nur 3342): npm run test:messages:single  — setzt SINGLE_WALLET=1 portabel (Windows/macOS/Linux).
 * Windows PowerShell: `set VAR=…` gilt NICHT für Kindprozesse. Stattdessen:
 *   $env:SINGLE_WALLET = '1'; npm run test:messages
 * Optional: MESSAGES_TEST_TIMEOUT_MS (ms, default 20000) für fetch-Timeout wenn APIs fehlen.
 * Bild: COMPACT_IMAGE_PATH (PNG/JPEG), SKIP_COMPACT_IMAGE=1 zum Überspringen.
 * Optional: COMPACT_MAX_PLAINTEXT_BYTES (4000–MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES) → max. Blob für FitChain.
 */

import { readFile } from 'node:fs/promises';
import { MESSAGING_MAX_PLAINTEXT_UTF8_BYTES } from '../src/chain-access.js';
import { extractCompactImageBase64FromWire } from '../src/compact-image-wire-extract.js';
import { MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES } from '../src/messenger-media-limits.js';
import { VaultImagePipeline } from '../src/vault-image-pipeline.js';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const SINGLE_WALLET = process.env.SINGLE_WALLET === '1' || process.env.SINGLE_WALLET === 'true';
const API_A = process.env.API_BASE_A || 'http://127.0.0.1:3342';
const API_B = SINGLE_WALLET ? API_A : process.env.API_BASE_B || 'http://127.0.0.1:3343';
/** Gegenüber für Fetch/Senden: bei SINGLE_WALLET dieselbe API wie A. */
const MSG_PEER = SINGLE_WALLET ? API_A : API_B;
const UNLOCK_PASSWORD = (process.env.UNLOCK_PASSWORD || '').trim();
/** Terminal A (3342) / Terminal B (3343) – Fallback: UNLOCK_PASSWORD für beide. */
const UNLOCK_PASSWORD_A = (process.env.UNLOCK_PASSWORD_A || UNLOCK_PASSWORD).trim();
const UNLOCK_PASSWORD_B = (process.env.UNLOCK_PASSWORD_B || UNLOCK_PASSWORD).trim();
const PAIRING_SECRET = (process.env.PAIRING_SECRET || 'rwmsg-peer-test-9').trim();
const SKIP_PEERING = process.env.SKIP_PEERING === '1' || process.env.SKIP_PEERING === 'true';
/** Ohne laufende APIs hängt fetch sonst sehr lange (TCP). */
const FETCH_TIMEOUT_MS = Math.max(3000, parseInt(process.env.MESSAGES_TEST_TIMEOUT_MS || '20000', 10) || 20000);

const SKIP_COMPACT_IMAGE =
  process.env.SKIP_COMPACT_IMAGE === '1' || process.env.SKIP_COMPACT_IMAGE === 'true';
/** Standard: wie lokaler UI-Test; per Env überschreibbar. */
const COMPACT_IMAGE_PATH =
  process.env.COMPACT_IMAGE_PATH ||
  String.raw`C:\Users\damast\Desktop\bilder\Telegram Desktop\hopium.png`;

const COMPACT_MAX_PT = parseInt(process.env.COMPACT_MAX_PLAINTEXT_BYTES || '', 10);
const COMPACT_ENCODE_MAX_BLOB =
  Number.isFinite(COMPACT_MAX_PT) &&
  COMPACT_MAX_PT >= 4000 &&
  COMPACT_MAX_PT <= MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES
    ? COMPACT_MAX_PT
    : undefined;

const COMPACT_IMG_PREFIX = '[[MORG_COMPACT_IMG_V1:';
const COMPACT_IMG_SUFFIX = ']]';

function wrapCompactImageWire(blobBase64: string, caption?: string): string {
  const core = COMPACT_IMG_PREFIX + blobBase64 + COMPACT_IMG_SUFFIX;
  return caption?.trim() ? `${core}\n\n${caption.trim()}` : core;
}

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
  console.log(
    `Konfiguration: API_A=${API_A}  API_B/MSG_PEER=${MSG_PEER}  SINGLE_WALLET=${SINGLE_WALLET}  (env SINGLE_WALLET=${JSON.stringify(process.env.SINGLE_WALLET ?? '')})\n`
  );
  if (SINGLE_WALLET) {
    console.log('Hinweis: SINGLE_WALLET=1 – eine API, Handshake/Connect an die eigene Adresse.\n');
  }

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
    if (addrA === addrB && !SINGLE_WALLET) {
      console.log('Hinweis: A und B haben dieselbe Adresse (Ein-Instanz). Connect/Handshake braucht zwei getrennte Server.\n');
    }
  } catch (e) {
    const err = e as { name?: string; cause?: { code?: string; message?: string } };
    const aborted = err?.name === 'AbortError';
    const refused = err?.cause?.code === 'ECONNREFUSED' || /ECONNREFUSED|connect/i.test(String(err?.cause?.message || ''));
    if (aborted) {
      console.error(
        SINGLE_WALLET
          ? `Keine Antwort von API (${FETCH_TIMEOUT_MS}ms Timeout). Messenger starten (z. B. API_PORT=3342), ggf. API_BASE_A setzen.`
          : `Keine Antwort von API (${FETCH_TIMEOUT_MS}ms Timeout). Zwei Messenger starten (z. B. 3342 + 3343), ggf. API_BASE_A / API_BASE_B setzen.`
      );
    } else if (refused) {
      const detail = String(err?.cause?.message || e);
      const looksLikeMissingSecondPort = !SINGLE_WALLET && /3343|127\.0\.0\.1:3343/i.test(detail);
      console.error(
        (SINGLE_WALLET
          ? `API nicht erreichbar (Verbindung verweigert). Eine Instanz starten, z. B.:\n` +
            `  API_PORT=3342 npm run start:backend\n` +
            `Oder API_BASE_A setzen.\n`
          : `API nicht erreichbar (Verbindung verweigert). Zwei Instanzen starten, z. B.:\n` +
            `  API A: API_PORT=3342 npm run start:backend\n` +
            `  API B: API_PORT=3343 npm run start:backend\n` +
            `Oder API_BASE_A / API_BASE_B auf laufende URLs setzen.\n`) +
          `Details: ${detail}`
      );
      if (looksLikeMissingSecondPort) {
        console.error(
          '\n→ Du hast vermutlich nur eine API (z. B. npm start auf :3342). Dann:\n' +
            '    npm run test:messages:single\n' +
            '  Oder in PowerShell (nicht „set …“ – das setzt keine Umgebung für Node):\n' +
            "    $env:SINGLE_WALLET = '1'; npm run test:messages\n"
        );
      }
    } else {
      console.error('Voraussetzung: Zwei erreichbare APIs (A und B) mit gesetzter MY_ADDRESS.', e);
    }
    process.exit(1);
  }

  console.log('Instanz A (Alice):', addrA.slice(0, 18) + '…');
  console.log(
    SINGLE_WALLET ? 'Instanz B (Bob):   (= A, Ein-Wallet-Modus)\n' : 'Instanz B (Bob):  ' + addrB.slice(0, 18) + '…\n'
  );

  // ═══ 1. Einrichtung & API-Abfragen ═══
  console.log('--- 1. Einrichtung & API-Abfragen ---');
  const reachA = (await apiGet(API_A, '/api/chain-reachable').catch(() => ({ reachable: false }))) as { reachable?: boolean };
  log('A: GET /api/chain-reachable', reachA.reachable === true, reachA.reachable ? 'Kette erreichbar' : 'nicht erreichbar / skip');

  const addrsA = (await apiGet(API_A, '/api/connect-addresses').catch(() => ({}))) as { addresses?: string[] };
  log('A: GET /api/connect-addresses', Array.isArray(addrsA.addresses), addrsA.addresses ? `${addrsA.addresses.length} Adresse(n)` : '–');
  const addrsB = (await apiGet(MSG_PEER, '/api/connect-addresses').catch(() => ({}))) as { addresses?: string[] };
  log('B: GET /api/connect-addresses', Array.isArray(addrsB.addresses), addrsB.addresses ? `${addrsB.addresses.length} Adresse(n)` : '–');

  const statusA0 = (await apiGet(API_A, '/api/status').catch(() => ({}))) as { connected?: boolean; locked?: boolean };
  const statusB0 = (await apiGet(MSG_PEER, '/api/status').catch(() => ({}))) as { connected?: boolean; locked?: boolean };
  log('A: GET /api/status (vor Connect)', true, `connected=${statusA0.connected}, locked=${statusA0.locked}`);
  log('B: GET /api/status (vor Connect)', true, `connected=${statusB0.connected}, locked=${statusB0.locked}`);

  const helpA = (await apiGet(API_A, '/api/help').catch(() => ({}))) as { helpText?: string };
  log('A: GET /api/help (vor Connect)', typeof helpA.helpText === 'string', helpA.helpText ? `${helpA.helpText.length} Zeichen` : '–');

  try {
    const lr = await fetchWithTimeout(`${API_A}/api/iota-name-lookup`, { method: 'GET' });
    const txt = await lr.text();
    log(
      'A: GET /api/iota-name-lookup (ohne ?name=)',
      lr.status === 400,
      lr.status === 400 ? '400 wie erwartet' : txt.slice(0, 120)
    );
  } catch (e) {
    log('A: GET /api/iota-name-lookup', false, String((e as Error)?.message || e));
  }

  const findB = (await apiGet(MSG_PEER, '/api/find-peer-handshake').catch(() => ({}))) as { found?: boolean };
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
    console.log(
      '  (Kein UNLOCK_PASSWORD / UNLOCK_PASSWORD_A|B – Wallets vorher in der UI entsperren; Abschnitt 7 ruft dann /vault-save ohne Passwort in den Args auf und nutzt die Server-Sitzung.)\n'
    );
  }

  // ═══ 1d. Kompaktes Bild: Klartext an eigene Adresse (Move-Limit ~16 KiB; kein /connect nötig) ═══
  if (!SKIP_COMPACT_IMAGE) {
    const imgResolved = resolve(COMPACT_IMAGE_PATH);
    let imageBytes: Buffer | null = null;
    try {
      if (existsSync(imgResolved)) {
        imageBytes = await readFile(imgResolved);
      } else {
        const sharp = (await import('sharp')).default;
        imageBytes = await sharp({
          create: { width: 16, height: 16, channels: 3, background: { r: 194, g: 65, b: 12 } },
        })
          .png()
          .toBuffer();
        log(
          'A: kompaktes Bild (Quelle)',
          true,
          `Sharp-Testbild 16×16 (COMPACT_IMAGE_PATH fehlt: ${imgResolved})`
        );
      }
    } catch (e) {
      log(
        'A: kompaktes Bild (Quelle)',
        false,
        existsSync(imgResolved)
          ? `Lesen fehlgeschlagen: ${String((e as Error)?.message || e)}`
          : `Kein Bild: ${String((e as Error)?.message || e)}`
      );
    }
    if (imageBytes) {
      console.log('\n--- 1d. Kompaktes Bild (lokal FitChain + /send-plain → eigene Adresse) ---');
      let encOk = false;
      let blobB64 = '';
      let wireApprox = 0;
      let totalBytes = 0;
      try {
        const maxBlob = COMPACT_ENCODE_MAX_BLOB ?? MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES;
        const r = await VaultImagePipeline.encodeToPlaintextBlobFitChain(imageBytes, maxBlob);
        blobB64 = r.plaintext.toString('base64');
        totalBytes = r.plaintext.length;
        wireApprox = COMPACT_IMG_PREFIX.length + blobB64.length + COMPACT_IMG_SUFFIX.length;
        encOk = totalBytes <= maxBlob && wireApprox <= 16_000;
        log(
          'A: lokal VaultImagePipeline.encodeToPlaintextBlobFitChain',
          encOk,
          `blob ${totalBytes} B (max ${maxBlob}), wire≈${wireApprox} B UTF-8 ohne Caption, dim ${r.usedMaxDim} q${r.usedQuality}`
        );
        if (!encOk) {
          log('A: Kompakt-Encode', false, 'Blob/Wire über erwartetes Limit – COMPACT_MAX_PLAINTEXT_BYTES senken');
        }
      } catch (e) {
        log('A: lokal FitChain-Encode', false, String((e as Error)?.message || e));
      }
      if (encOk && blobB64) {
        const tag = String(Date.now()).slice(-8);
        const caption = `rw-plain-self ${tag}`;
        const wire = wrapCompactImageWire(blobB64, caption);
        const wireUtf8 = new TextEncoder().encode(wire).length;
        log(
          'A: Wire UTF-8 (Marker+Blob+Caption)',
          wireUtf8 <= MESSAGING_MAX_PLAINTEXT_UTF8_BYTES,
          `${wireUtf8} B (max ${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES})`
        );
        if (wireUtf8 > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
          log('A: /send-plain (kompaktes Bild)', false, 'Wire zu lang – Encoder/Caption anpassen');
        } else {
          const sendImg = await command(API_A, '/send-plain', [addrA, wire]);
          log('A: /send-plain (kompaktes Bild → eigene Adresse)', sendImg.ok === true, sendImg.message || sendImg.error);
          await sleep(5000);
          const fetchImg = (await apiPost(API_A, '/api/command', {
            cmd: '/fetch',
            args: ['25'],
          })) as { ok?: boolean; messages?: Array<{ text?: string }>; error?: string };
          const msgs = fetchImg.messages || [];
          const hit = msgs.some((m) => (m.text || '').includes(caption) && (m.text || '').includes(COMPACT_IMG_PREFIX));
          log(
            'A: /fetch – Klartext-Bild sichtbar',
            fetchImg.ok === true && hit,
            fetchImg.ok ? `${msgs.length} Nachricht(en)` : fetchImg.error
          );
          const sample = msgs.find((m) => (m.text || '').includes(caption) && (m.text || '').includes(COMPACT_IMG_PREFIX));
          const inboxText = sample?.text != null ? String(sample.text) : '';
          const extracted = extractCompactImageBase64FromWire(inboxText);
          let pngDecodeOk = false;
          if (extracted) {
            try {
              const png = await VaultImagePipeline.reconstructBlendToPng(Buffer.from(extracted, 'base64'));
              pngDecodeOk = png.length > 32;
            } catch {
              pngDecodeOk = false;
            }
          }
          log(
            'A: Fetch-Wire → extractCompactImage → PNG (Server)',
            Boolean(extracted) && pngDecodeOk,
            extracted
              ? `Blob extrahiert, PNG ${pngDecodeOk ? 'ok' : 'fehlgeschlagen'} (${inboxText.length} Zeichen Inbox)`
              : 'Extraktion fehlgeschlagen'
          );
        }
      }
    }
  }

  // ═══ 2. Verbindung: zuerst Geheimnis-Peering (wenn möglich), sonst klassischer Handshake ═══
  const cancelStaleConnect = async () => {
    const ca = await command(API_A, '/cancel-connect', []);
    log('A: /cancel-connect (vor Verbindungstest)', ca.ok === true, ca.message || ca.error || '');
    if (SINGLE_WALLET) return;
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

  if (SINGLE_WALLET) {
    console.log('--- 2. Ein-Wallet: /connect → /handshake (eigene Adresse) → /connect ---');
    const connectPromise = command(API_A, '/connect', [addrA]).catch((e): CommandResult => ({
      ok: false,
      error: String((e as Error)?.message || e),
    }));
    await sleep(2500);
    const handshakeSelf = await command(API_A, '/handshake', [addrA]);
    log('A: /handshake an eigene Adresse', handshakeSelf.ok === true, handshakeSelf.message || handshakeSelf.error || '');
    const connectRes = await connectPromise;
    log('A: /connect (wartet auf Handshake)', connectRes.ok === true, connectRes.message || connectRes.error || '');
    if (!connectRes.ok) {
      console.log('   Connect fehlgeschlagen – weitere Tests übersprungen.\n');
      console.log('=== Ende Nachrichten & Chat ===\n');
      return;
    }
    await sleep(2000);
    const connectA2 = await command(API_A, '/connect', [addrA]);
    log('A: /connect (zweiter Lauf)', connectA2.ok === true, connectA2.message || connectA2.error || '');
    let selfReady = false;
    for (let i = 0; i < 90; i++) {
      await sleep(2000);
      const statusA = (await apiGet(API_A, '/api/status').catch(() => ({}))) as { connected?: boolean };
      if (statusA.connected) {
        selfReady = true;
        break;
      }
    }
    if (!selfReady) {
      console.log('   Hinweis: Nach 180s nicht „verbunden“ – Selbst-Handshake kann je nach Move-Mailbox ausbleiben; /send kann fehlschlagen.');
    }
  } else {
    const readPairStatus = async () => {
      const a = (await apiGet(API_A, '/api/status').catch(() => ({}))) as { connected?: boolean };
      const b = (await apiGet(MSG_PEER, '/api/status').catch(() => ({}))) as { connected?: boolean };
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
        const statusB = (await apiGet(MSG_PEER, '/api/status').catch(() => ({}))) as { connected?: boolean };
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
  }

  const statusA1 = (await apiGet(API_A, '/api/status')) as { connected?: boolean; partnerCount?: number };
  const statusB1 = (await apiGet(MSG_PEER, '/api/status')) as { connected?: boolean; partnerCount?: number };
  log('A: GET /api/status (nach Connect)', statusA1.connected === true, `connected=${statusA1.connected}, partnerCount=${statusA1.partnerCount ?? '?'}`);
  log('B: GET /api/status (nach Connect)', statusB1.connected === true, `connected=${statusB1.connected}, partnerCount=${statusB1.partnerCount ?? '?'}`);

  const peerConnected = SINGLE_WALLET ? statusA1.connected === true : statusA1.connected === true && statusB1.connected === true;
  if (!peerConnected) {
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

  const fetchB = (await apiPost(MSG_PEER, '/api/command', { cmd: '/fetch', args: ['10'] })) as { ok?: boolean; messages?: Array<{ sender?: string; text?: string }>; error?: string };
  const messagesB = fetchB.messages || [];
  const hasFromA = messagesB.some((m) => (m.text || '').includes('Test von A an B'));
  log('B: /fetch 10 – Nachricht von A sichtbar', fetchB.ok === true && hasFromA, fetchB.ok ? `${messagesB.length} Nachricht(en)` : fetchB.error);

  const send2 = await command(MSG_PEER, '/send', ['Antwort von B an A']);
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
  const fetchBFromA = (await apiPost(MSG_PEER, '/api/command', { cmd: '/fetch', args: ['5', addrA] })) as { ok?: boolean; messages?: Array<{ text?: string }> };
  log('B: /fetch 5 <addrA> (nur von A)', fetchBFromA.ok === true, fetchBFromA.ok ? `${(fetchBFromA.messages || []).length} Nachricht(en)` : '–');

  const fetchAFromB = (await apiPost(API_A, '/api/command', { cmd: '/fetch', args: ['5', addrB] })) as { ok?: boolean; messages?: Array<{ text?: string }> };
  log('A: /fetch 5 <addrB> (nur von B)', fetchAFromB.ok === true, fetchAFromB.ok ? `${(fetchAFromB.messages || []).length} Nachricht(en)` : '–');

  // Fetch mit anderer Anzahl (Option n)
  const fetchB3 = (await apiPost(MSG_PEER, '/api/command', { cmd: '/fetch', args: ['3'] })) as { ok?: boolean; messages?: unknown[] };
  log('B: /fetch 3 (kleinere Anzahl)', fetchB3.ok === true, fetchB3.ok ? `${(fetchB3.messages || []).length} Nachricht(en)` : '–');

  // ═══ 5. Klartext (/send-plain) ═══
  console.log('\n--- 5. Klartext (/send-plain) ---');
  const sendPlain = await command(API_A, '/send-plain', [addrB, 'Klartext-Test von A']);
  if (sendPlain.ok) {
    log('A: /send-plain an B', true, sendPlain.message);
    await sleep(3000);
    const fetchB2 = (await apiPost(MSG_PEER, '/api/command', { cmd: '/fetch', args: ['5'] })) as { ok?: boolean; messages?: Array<{ text?: string }> };
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
    const pm = purgeHandshake.message || '';
    const noopMailbox = /MAILBOX_ID nicht gesetzt|MAILBOX_ID fehlt|keine mailbox/i.test(pm);
    log(
      'A: /purge-handshake (Folgeoption)',
      true,
      noopMailbox ? `${pm} (OK · erwartbar ohne MAILBOX_ID / kein Purge-Pfad)` : pm
    );
  } else {
    log('A: /purge-handshake (Folgeoption)', purgeSkip, purgeSkip ? purgeHandshake.error || purgeHandshake.message : (purgeHandshake.error || purgeHandshake.message || '–'));
  }

  // ═══ 7. Vault lokal sichern (API) ═══
  console.log('\n--- 7. Vault (/vault-save) + hasLocal ---');
  const incSdk = process.env.VAULT_SAVE_INCLUDE_SDK === '1';
  /** Mit explizitem Passwort (Env) oder leer → Server nutzt Sitzung nach UI-Unlock (`getWalletPassword()`). */
  const vaultSaveCmdArgs = (explicitPw: string): string[] => {
    const pw = explicitPw.trim();
    if (pw) return vaultSaveArgs(pw, incSdk);
    return incSdk ? ['', '', '', 'includeIotaMnemonic'] : [];
  };
  const vsA = await command(API_A, '/vault-save', vaultSaveCmdArgs(UNLOCK_PASSWORD_A));
  const detailA = vsA.message || vsA.error || '';
  log(
    'A: /vault-save',
    vsA.ok === true,
    detailA +
      (!UNLOCK_PASSWORD_A && vsA.ok ? ' (Server-Sitzung: UI-Unlock, kein Env-Passwort nötig)' : '') +
      (!vsA.ok && !UNLOCK_PASSWORD_A ? ' — Tipp: API nach `POST /api/unlock` nutzen oder UNLOCK_PASSWORD_A setzen.' : '')
  );
  if (!SINGLE_WALLET) {
    const vsB = await command(API_B, '/vault-save', vaultSaveCmdArgs(UNLOCK_PASSWORD_B));
    const detailB = vsB.message || vsB.error || '';
    log(
      'B: /vault-save',
      vsB.ok === true,
      detailB +
        (!UNLOCK_PASSWORD_B && vsB.ok ? ' (Server-Sitzung: UI-Unlock)' : '') +
        (!vsB.ok && !UNLOCK_PASSWORD_B ? ' — Tipp: zweite Instanz entsperren oder UNLOCK_PASSWORD_B setzen.' : '')
    );
  } else {
    console.log('  (Ein-Wallet: kein zweites /vault-save auf B.)\n');
  }
  const stVA = (await apiGet(API_A, '/api/status').catch(() => ({}))) as { vaultStatus?: { hasLocal?: boolean } };
  const stVB = (await apiGet(MSG_PEER, '/api/status').catch(() => ({}))) as { vaultStatus?: { hasLocal?: boolean } };
  log('A: vaultStatus.hasLocal', stVA.vaultStatus?.hasLocal === true);
  log('B: vaultStatus.hasLocal', stVB.vaultStatus?.hasLocal === true);

  console.log('\n=== Ende Nachrichten & Chat ===');
  console.log(
    'Durchgespielt: Einrichtung, optional kompaktes Bild (Klartext Selbst), Geheimnis-Peering optional, Handshake+Connect, /send, /fetch, Sender-Filter, /send-plain, purge-handshake, /vault-save + hasLocal.'
  );
  console.log(
    'Env (Auszug): UNLOCK_PASSWORD_* optional für /vault-save in frischer API-Sitzung; sonst UI-Unlock vor dem Test. SKIP_PEERING=1; PAIRING_SECRET=…; VAULT_SAVE_INCLUDE_SDK=1; SINGLE_WALLET=1; COMPACT_IMAGE_PATH; SKIP_COMPACT_IMAGE=1.\n'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
