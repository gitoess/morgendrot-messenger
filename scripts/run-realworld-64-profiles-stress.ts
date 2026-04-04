/**
 * Real-World-Stress: Alle 64 Profile (id-00 … id-63) + viele Befehle → viele TX.
 *
 * 1. Optional: 64 Geräte provisionieren (PROVISION_64=1), liefert 64 Adressen.
 * 2. Führt hunderte Befehle aus: /list-keys, /list-tickets, /device-status, /heartbeat,
 *    /streams-status, /streams-fetch, /boss-command, /send-plain, /vault-save, /fetch, …
 * 3. Kombinationen so gewählt, dass viele echte Chain-TX entstehen (heartbeat, boss-command, send-plain).
 *
 * Aufruf:
 *   API_BASE=http://127.0.0.1:3342 npx tsx scripts/run-realworld-64-profiles-stress.ts
 *   PROVISION_64=1 API_BASE=http://127.0.0.1:3342 npx tsx scripts/run-realworld-64-profiles-stress.ts
 *   MAX_CMD=500 npx tsx scripts/run-realworld-64-profiles-stress.ts
 *
 * Voraussetzung: Backend läuft als Boss (ROLE=boss, ROLE_ID mit S-Bit z. B. 63), Wallet entsperrt.
 */

import 'dotenv/config';

const DEFAULT_PORTS = [3342, 3343, 3344, 3345];
async function findApiBase(): Promise<string> {
  const env = (process.env.API_BASE || '').replace(/\/$/, '');
  if (env) return env;
  for (const port of DEFAULT_PORTS) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        console.log('Gefunden: Backend auf Port', port, '(API_BASE=http://127.0.0.1:' + port + ')');
        return `http://127.0.0.1:${port}`;
      }
    } catch {}
  }
  return 'http://127.0.0.1:3342';
}
let API_BASE = '';
const PROVISION_64 = process.env.PROVISION_64 === '1' || process.env.PROVISION_64 === 'true';
const MAX_CMD = Math.min(2000, Math.max(50, parseInt(process.env.MAX_CMD || '350', 10) || 350));
const DELAY_MS = Math.max(100, parseInt(process.env.STRESS_DELAY_MS || '200', 10) || 200);

async function get(path: string): Promise<Record<string, unknown>> {
  const r = await fetch(API_BASE + path);
  return (await r.json().catch(() => ({}))) as Record<string, unknown>;
}

async function post(path: string, data: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return (await r.json().catch(() => ({}))) as Record<string, unknown>;
}

function cmd(cmdName: string, args: string[] = []): Promise<Record<string, unknown>> {
  return post('/api/command', { cmd: cmdName, args });
}

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function main() {
  console.log('=== Real-World: 64 Profile + viele Befehle → viele TX\n');
  API_BASE = await findApiBase();
  console.log('API_BASE:', API_BASE);
  console.log('PROVISION_64:', PROVISION_64);
  console.log('MAX_CMD:', MAX_CMD);
  console.log('');

  const status = await get('/api/status');
  if (!status || typeof status.backendRunning === 'undefined') {
    console.error('Backend nicht erreichbar unter', API_BASE);
    console.error('  → Backend starten: npm run start:secrets');
    console.error('  → Port prüfen: In der Adresszeile des Browsers steht der Port (z. B. 3342).');
    console.error('  → Dann: $env:API_BASE = "http://127.0.0.1:3342"');
    process.exit(1);
  }
  if (status.locked === true) {
    console.error('Backend gesperrt. Bitte Wallet im Browser entsperren (dieselbe URL wie API_BASE).');
    process.exit(1);
  }
  if (!status.backendRunning) {
    console.error('Backend nicht bereit.');
    process.exit(1);
  }

  const ids = await get('/api/current-ids') as { ok?: boolean; myAddress?: string; packageId?: string; streamsAnchorId?: string };
  const bossAddress = ids.myAddress || '';
  const packageId = ids.packageId || process.env.PACKAGE_ID || '';
  if (!bossAddress) {
    console.error('MY_ADDRESS fehlt (current-ids).');
    process.exit(1);
  }
  log('Boss: ' + bossAddress.slice(0, 18) + '…');

  let targetAddresses: string[] = [];
  if (PROVISION_64) {
    log('Provisioning 64 Geräte (roleId 0..63) …');
    for (let roleId = 0; roleId < 64; roleId++) {
      const gen = await post('/api/generate-mnemonic', {}) as { ok?: boolean; address?: string; secretKey?: string };
      if (!gen.ok || !gen.address) {
        log(`  roleId ${roleId}: Mnemonic fehlgeschlagen, überspringe.`);
        continue;
      }
      const res = await post('/api/provision-device', {
        role: 'arbeiter',
        roleId,
        deviceName: `Stress-${roleId}`,
        address: gen.address,
        mnemonic: gen.secretKey ? undefined : undefined,
        bossAddress,
        packageId,
        rpcUrl: API_BASE,
        enableHeartbeat: (roleId & 2) !== 0,
        heartbeatIntervalMs: 30000,
      }) as { ok?: boolean; jsonConfig?: { address?: string }; error?: string };
      if (res.ok && res.jsonConfig?.address) {
        targetAddresses.push(res.jsonConfig.address);
      } else {
        targetAddresses.push(gen.address);
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    log(`  → ${targetAddresses.length} Adressen gesammelt.`);
  } else {
    const partner = process.env.TARGET_ADDRESS || process.env.PARTNER_ADDRESS || '';
    if (partner && /^0x[a-fA-F0-9]{64}$/.test(partner)) targetAddresses = [partner];
    if (targetAddresses.length === 0) targetAddresses = [bossAddress];
    log('Zieladressen: ' + targetAddresses.length + ' (ohne PROVISION_64; nutze TARGET_ADDRESS oder Boss selbst).');
  }

  type CmdSpec = { cmd: string; args: string[]; tx?: boolean };
  const commands: CmdSpec[] = [];

  for (let i = 0; i < 15; i++) commands.push({ cmd: '/list-keys', args: [] });
  for (let i = 0; i < 15; i++) commands.push({ cmd: '/list-tickets', args: [] });
  for (let i = 0; i < 20; i++) commands.push({ cmd: '/fetch', args: [String(5 + (i % 10))] });
  for (let i = 0; i < 10; i++) commands.push({ cmd: '/device-status', args: [] });
  for (let i = 0; i < 8; i++) commands.push({ cmd: '/streams-status', args: [] });
  for (let i = 0; i < 8; i++) commands.push({ cmd: '/streams-fetch', args: [] });
  for (let i = 0; i < 5; i++) commands.push({ cmd: '/set-heartbeat-interval', args: ['30'] });
  for (let i = 0; i < 3; i++) commands.push({ cmd: '/vault-save', args: [], tx: true });
  for (let i = 0; i < 12; i++) commands.push({ cmd: '/heartbeat', args: [], tx: true });
  for (const addr of targetAddresses.slice(0, 32)) {
    commands.push({ cmd: '/boss-command', args: [JSON.stringify([addr]), '/device-status'], tx: true });
    commands.push({ cmd: '/boss-command', args: [JSON.stringify([addr]), '/heartbeat'], tx: true });
  }
  for (const addr of targetAddresses.slice(0, 24)) {
    commands.push({ cmd: '/send-plain', args: [addr, `Stress ${Date.now()} id-${targetAddresses.indexOf(addr)}`], tx: true });
  }
  for (let i = 0; i < 20; i++) {
    const addr = targetAddresses[i % targetAddresses.length];
    commands.push({ cmd: '/boss-command', args: [JSON.stringify([addr]), 'status'], tx: true });
  }
  for (let i = 0; i < 10; i++) commands.push({ cmd: '/inbox', args: [] });
  for (let i = 0; i < 8; i++) commands.push({ cmd: '/purge-hs-cache', args: [] });
  for (let i = 0; i < 5; i++) commands.push({ cmd: '/purge-inbox', args: [] });

  const shuffled = commands.slice(0, MAX_CMD);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let ok = 0, fail = 0, txEst = 0;
  const failReasons: Record<string, number> = {};
  function countFail(msg: string) {
    const key = (msg || 'unknown').slice(0, 60).replace(/\s+/g, ' ');
    failReasons[key] = (failReasons[key] || 0) + 1;
  }
  log(`Starte ${shuffled.length} Befehle …`);
  for (let i = 0; i < shuffled.length; i++) {
    const { cmd: c, args, tx } = shuffled[i];
    try {
      const res = await cmd(c, args);
      if (res.ok) {
        ok++;
        if (tx) txEst++;
      } else {
        fail++;
        countFail(String((res as { message?: string; error?: string }).message || (res as { error?: string }).error));
      }
    } catch (e: unknown) {
      fail++;
      countFail(e instanceof Error ? e.message : String(e));
    }
    if ((i + 1) % 50 === 0) log(`  ${i + 1}/${shuffled.length} (ok=${ok}, fail=${fail}, tx≈${txEst})`);
    if (tx && DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log('');
  log(`Fertig: ${ok} ok, ${fail} fehlgeschlagen. Geschätzte Chain-TX: ~${txEst}.`);
  const entries = Object.entries(failReasons).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (entries.length > 0) {
    console.log('  Häufigste Fehlerursachen:');
    for (const [reason, n] of entries) console.log('    ' + n + '× ' + reason);
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
