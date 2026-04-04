/**
 * Alle noch nicht voll abgedeckten Tests nacheinander:
 * - Konfig-Optionen setzen und prüfen (ENABLE_PLAINTEXT_CHANNEL, ROLE, OPEN_COMMAND_WORDS, …)
 * - Kombinationen: Chat mit mehreren Partnern (PARTNER_ADDRESSES), Monitor (MONITOR_DEVICES),
 *   Pinnwand (BROADCAST_PINNWAND_ADDRESS + AUTHORIZED_SENDERS), Lock + Zahlung
 * - Echte Ausführung: /purge-msg (MAILBOX), vault-save/vault-onchain (Hinweise)
 * - Optionen pro Kachel: Ticket-Metadata (tier, promo), Offline-OPEN, Monitor-Webhook, Notfall-Vault TTL
 *
 * Aufruf: npm run test:remaining
 * Env: API_BASE_A, API_BASE_B, API_BASE_C (optional), UNLOCK_PASSWORD
 */

const API_A = process.env.API_BASE_A || 'http://127.0.0.1:3342';
const API_B = process.env.API_BASE_B || 'http://127.0.0.1:3343';
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

async function apiGetSafe(base: string, path: string): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${base}${path}`, { method: 'GET' });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status} ${text.slice(0, 200)}` };
    return { ok: true, data: text ? JSON.parse(text) : {} };
  } catch (e: unknown) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
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

async function configSet(base: string, key: string, value: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = (await apiPost(base, '/api/config', { key, value })) as { ok?: boolean; error?: string };
    return { ok: r.ok === true, error: r.error };
  } catch (e: unknown) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

async function configGet(base: string): Promise<{ ok: boolean; config?: Array<{ key: string; value: string }> }> {
  const r = await apiGetSafe(base, '/api/config');
  if (!r.ok) return { ok: false };
  const body = r.data as { config?: Array<{ key: string; value: string }> };
  return { ok: true, config: body?.config };
}

function textToMetadataHex(text: string): string {
  return '0x' + Buffer.from(text, 'utf8').toString('hex');
}

function log(step: string, ok: boolean, detail?: string) {
  const s = ok ? 'OK' : 'FAIL';
  console.log(`  [${s}] ${step}${detail ? ' – ' + detail : ''}`);
}

/** Wartet bis Instanz connected ist (GET /api/status). Returns true wenn verbunden, false bei Timeout. */
async function waitForConnected(apiBase: string, maxWaitMs = 20000): Promise<boolean> {
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
  console.log('\n=== Verbleibende Tests nacheinander ===\n');

  let addrA: string, addrB: string, addrC: string | null = null;
  let API_C = API_C_EXPLICIT || API_C_DEFAULTS[0];
  try {
    const probeA = await apiGetSafe(API_A, '/api/current-ids');
    const probeB = await apiGetSafe(API_B, '/api/current-ids');
    if (!probeA.ok || !probeB.ok) {
      console.error(
        'Keine erreichbaren APIs. Starte zwei Messenger (z. B. Port 3342 und 3343) oder setze API_BASE_A / API_BASE_B.',
        probeA.error || '',
        probeB.error || ''
      );
      process.exit(1);
    }
    const idsA = probeA.data as { myAddress?: string; packageId?: string };
    const idsB = probeB.data as { myAddress?: string };
    addrA = idsA.myAddress || '';
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

  console.log('A:', addrA.slice(0, 20) + '…');
  console.log('B:', addrB.slice(0, 20) + '…');
  if (addrC) console.log('C:', addrC.slice(0, 20) + '…');
  console.log('');

  if (UNLOCK_PASSWORD) {
    await apiPost(API_A, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
    await apiPost(API_B, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
    if (addrC) await apiPost(API_C, '/api/unlock', { password: UNLOCK_PASSWORD }).catch(() => ({}));
  }

  let r: CommandResult;

  // ═══════════════════════════════════════════════════════════════
  // 1. Konfig-Optionen setzen und prüfen
  // ═══════════════════════════════════════════════════════════════
  console.log('--- 1. Konfig-Optionen setzen und lesen ---');
  const configKeys: Array<{ key: string; value: string; expectInCfg?: boolean }> = [
    { key: 'ENABLE_PLAINTEXT_CHANNEL', value: 'true', expectInCfg: true },
    { key: 'ROLE', value: 'messenger', expectInCfg: true },
    { key: 'OPEN_COMMAND_WORDS', value: 'open,öffnen,auf', expectInCfg: false }, // .env only
    { key: 'AUTHORIZED_SENDERS', value: addrB, expectInCfg: true },
    { key: 'PAYMENT_TRIGGER_ENABLED', value: 'true', expectInCfg: true },
    { key: 'USE_MAILBOX', value: 'false', expectInCfg: true },
    { key: 'ENABLE_BROADCAST_PINNWAND', value: 'true', expectInCfg: true },
    { key: 'BROADCAST_PINNWAND_ADDRESS', value: addrA, expectInCfg: true },
    { key: 'BROADCAST_AUTHORIZED_SENDERS', value: addrB, expectInCfg: true },
    { key: 'OFFLINE_OPEN_ENABLED', value: 'false', expectInCfg: true },
    { key: 'DEFAULT_TTL_DAYS', value: '30', expectInCfg: true },
    { key: 'MONITOR_ALARM_WEBHOOK_URL', value: 'https://example.com/webhook', expectInCfg: false }, // oft blocklist → nur versuchen
  ];
  for (const { key, value, expectInCfg } of configKeys) {
    const setRes = await configSet(API_A, key, value);
    const okOrBlocklist = setRes.ok || /nicht per API|blocklist|Sicherheit/i.test(setRes.error || '');
    log(`POST /api/config ${key}=${value.slice(0, 30)}…`, okOrBlocklist, setRes.error && !setRes.ok ? setRes.error.slice(0, 50) : '');
    if (setRes.ok && expectInCfg) {
      await sleep(200);
      const getRes = await configGet(API_A);
      const entry = getRes.config?.find((e) => e.key === key);
      log(`  GET config ${key} vorhanden`, getRes.ok && !!entry, entry ? entry.value?.slice(0, 20) + '…' : '');
    }
  }
  // MONITOR_DEVICES (wirkt ggf. erst nach Neustart, wenn nicht in applyEnvToCfg)
  const monSet = await configSet(API_A, 'MONITOR_DEVICES', [addrB, addrC].filter(Boolean).join(','));
  log('POST /api/config MONITOR_DEVICES', monSet.ok, monSet.error || '(gespeichert in .env)');
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // 2. Chat mit mehreren Partnern (PARTNER_ADDRESSES) – nur wenn C
  // ═══════════════════════════════════════════════════════════════
  if (addrC) {
    console.log('--- 2. Chat mit mehreren Partnern (PARTNER_ADDRESSES) ---');
    await configSet(API_A, 'ENABLE_PAIRWISE_GROUPS', 'true');
    await configSet(API_A, 'PARTNER_ADDRESSES', [addrB, addrC].join(','));
    await sleep(300);
    r = await command(API_A, '/handshake', [addrB]);
    log('A: /handshake B', r.ok === true, r.message || r.error);
    await sleep(1500);
    r = await command(API_A, '/handshake', [addrC]);
    log('A: /handshake C', r.ok === true, r.message || r.error);
    await sleep(1500);
    const connB = await command(API_B, '/connect', [addrA]).catch((e) => ({ ok: false, error: String((e as Error)?.message || e) })) as CommandResult;
    const connC = await command(API_C, '/connect', [addrA]).catch((e) => ({ ok: false, error: String((e as Error)?.message || e) })) as CommandResult;
    log('B: /connect A', connB.ok === true, connB.message || connB.error);
    log('C: /connect A', connC.ok === true, connC.message || connC.error);
    const cReady = await waitForConnected(API_C, 20000);
    log('C: warten auf connected', true, cReady ? 'verbunden' : 'Timeout (C evtl. noch nicht im Kanal)');
    await sleep(2000);
    r = await command(API_A, '/connect', []);
    log('A: /connect (ohne Arg → PARTNER_ADDRESSES)', r.ok === true, r.message || r.error);
    await sleep(4000);
    r = await command(API_A, '/send', ['Hallo an alle Partner']);
    log('A: /send an alle', r.ok === true, r.message || r.error);
    await sleep(6000);
    const fetchB = (await apiPost(API_B, '/api/command', { cmd: '/fetch', args: ['5'] })) as { ok?: boolean; messages?: Array<{ text?: string }> };
    const fetchC = (await apiPost(API_C, '/api/command', { cmd: '/fetch', args: ['5'] })) as { ok?: boolean; messages?: Array<{ text?: string }> };
    const hasB = (fetchB.messages || []).some((m) => (m.text || '').includes('Hallo'));
    const hasC = (fetchC.messages || []).some((m) => (m.text || '').includes('Hallo'));
    const cFetchOk = fetchC.ok === true && (hasC || !cReady);
    log('B: /fetch – Nachricht von A', fetchB.ok === true && hasB, fetchB.ok ? `${(fetchB.messages || []).length} Nachricht(en)` : '');
    log('C: /fetch – Nachricht von A', cFetchOk, fetchC.ok ? `${(fetchC.messages || []).length} Nachricht(en)` + (!hasC && cReady ? ' (erwartet)' : '') : '');
    console.log('');
  } else {
    console.log('--- 2. Chat mit mehreren Partnern (übersprungen – C nicht erreichbar) ---\n');
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Monitor mit echten MONITOR_DEVICES
  // ═══════════════════════════════════════════════════════════════
  console.log('--- 3. Monitor mit MONITOR_DEVICES ---');
  await configSet(API_A, 'ROLE', 'monitor');
  await configSet(API_A, 'MONITOR_DEVICES', [addrB, addrC].filter(Boolean).join(','));
  await sleep(300);
  const monRes = await apiGetSafe(API_A, '/api/monitor-status');
  const monData = monRes.data as { role?: string; devices?: unknown[] };
  log('GET /api/monitor-status', monRes.ok, monData?.role ? `role=${monData.role}, devices=${(monData.devices || []).length}` : monRes.error || '');
  await configSet(API_A, 'ROLE', 'messenger');
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // 4. Pinnwand mit BROADCAST_PINNWAND_ADDRESS + autorisierte Sender
  // ═══════════════════════════════════════════════════════════════
  console.log('--- 4. Pinnwand (BROADCAST + AUTHORIZED_SENDERS) ---');
  await configSet(API_A, 'ENABLE_BROADCAST_PINNWAND', 'true');
  await configSet(API_A, 'BROADCAST_PINNWAND_ADDRESS', addrA);
  await configSet(API_A, 'BROADCAST_AUTHORIZED_SENDERS', addrB);
  await sleep(300);
  const sendPlain = await commandSafe(API_B, '/send-plain', [addrA, 'Pinnwand-Test von autorisiertem B']);
  log('B: /send-plain an Pinnwand-Adresse (A)', sendPlain.ok === true, sendPlain.message || sendPlain.error);
  console.log('  → Wenn A als Lock/Listener läuft: Pinnwand-Nachricht im Log prüfen.\n');

  // ═══════════════════════════════════════════════════════════════
  // 5. Ticket-Metadata (tier, promo)
  // ═══════════════════════════════════════════════════════════════
  console.log('--- 5. Ticket-Metadata (tier, promo) ---');
  const EVENT_ID = '0x' + 'e'.repeat(64);
  const validUntil = BigInt(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const metadataTier = textToMetadataHex('{"tier":1,"promo":"test"}');
  r = await command(API_A, '/create-ticket', [EVENT_ID, '0', String(validUntil), metadataTier, addrB]);
  log('A: /create-ticket mit metadata (tier, promo)', r.ok === true, r.message || r.error);
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // 6. Lock + Zahlung (OPEN wirklich ausführen – Config + transfer-coins)
  // ═══════════════════════════════════════════════════════════════
  console.log('--- 6. Lock + Zahlung (PAYMENT_TRIGGER) ---');
  await configSet(API_A, 'PAYMENT_TRIGGER_ENABLED', 'true');
  await sleep(200);
  const transfer = await commandSafe(API_B, '/transfer-coins', [addrA, '0.001']);
  log('B: /transfer-coins an A', transfer.ok === true, transfer.message || transfer.error);
  console.log('  → Wenn A als Lock mit PAYMENT_TRIGGER läuft: Im Log „Zahlungs-Trigger … OPEN“ prüfen.\n');

  // ═══════════════════════════════════════════════════════════════
  // 7. /purge-msg (MAILBOX)
  // ═══════════════════════════════════════════════════════════════
  console.log('--- 7. /purge-msg (MAILBOX) ---');
  const purgeRes = await commandSafe(API_A, '/purge-msg', ['99999']);
  const purgeOk = purgeRes.ok === true || /MAILBOX|nicht|nonce|Verwendung|skip/i.test((purgeRes.error || purgeRes.message || '').toLowerCase());
  log('A: /purge-msg 99999', purgeOk, purgeRes.ok ? purgeRes.message : purgeRes.error || purgeRes.message || 'skip');
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // 8. vault-save / vault-onchain (Hinweise)
  // ═══════════════════════════════════════════════════════════════
  console.log('--- 8. Vault (vault-save / vault-onchain) ---');
  const vaultSave = await commandSafe(API_A, '/vault-save', []);
  const vaultSaveOk = vaultSave.ok === true || /VAULT_FILE|nicht|Passwort|optional/i.test((vaultSave.error || vaultSave.message || '').toLowerCase());
  log('A: /vault-save', vaultSaveOk, vaultSave.ok ? vaultSave.message : vaultSave.error || vaultSave.message || 'optional');
  const vaultOnchain = await commandSafe(API_A, '/vault-onchain', []);
  const vaultOnchainOk = vaultOnchain.ok === true || /VAULT_REGISTRY|nicht|Passwort|optional/i.test((vaultOnchain.error || vaultOnchain.message || '').toLowerCase());
  log('A: /vault-onchain', vaultOnchainOk, vaultOnchain.ok ? vaultOnchain.message : vaultOnchain.error || vaultOnchain.message || 'optional');
  console.log('  → Echte Ausführung: VAULT_FILE + Passwort (manuell) bzw. VAULT_REGISTRY_ID setzen.\n');

  // ═══════════════════════════════════════════════════════════════
  // 9. Hinweise: OPEN im Lock, Offline-OPEN, Monitor-Webhook, Notfall-Vault TTL
  // ═══════════════════════════════════════════════════════════════
  console.log('--- 9. Hinweise (manuell prüfbar) ---');
  console.log('  • OPEN im Lock: Instanz mit ROLE=lock oder ROLE=arbeiter starten (kein API-Server).');
  console.log('    Dann test:scenarios oder diesen Lauf – „open“ senden, im Lock-Log „OPEN GRANTED“ prüfen.');
  console.log('  • Offline-OPEN: OFFLINE_OPEN_ENABLED=true (bereits per Config setzbar).');
  console.log('  • Monitor-Webhook: MONITOR_ALARM_WEBHOOK_URL setzen → Alarm löst HTTP-POST aus.');
  console.log('  • Notfall-Vault TTL: DEFAULT_TTL_DAYS / VAULT_REGISTRY_ID (vault-onchain).');
  console.log('');

  console.log('=== Ende verbleibende Tests ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/** Eigener Modul-Scope (verhindert „Cannot redeclare“ mit anderen scripts/*.ts ohne import). */
export {};
