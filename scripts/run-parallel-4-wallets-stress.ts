/**
 * 4-Wallet-Parallel-Stresstest: Mehrere Backends (je 1 Wallet) feuern gleichzeitig On-Chain-Befehle.
 * Beweist Skalierbarkeit: withTxSerial ist pro Gas-Payer, also laufen 4 Wallets parallel.
 *
 * Aufruf:
 *   API_BASES=http://127.0.0.1:3342,http://127.0.0.1:3343,http://127.0.0.1:3344,http://127.0.0.1:3345 npx tsx scripts/run-parallel-4-wallets-stress.ts
 *   API_BASES=http://127.0.0.1:3342 npx tsx scripts/run-parallel-4-wallets-stress.ts   # 1 Wallet (Skript-Check)
 *   PARALLEL_STRESS_QUICK=1   # Weniger Aktionen pro Wallet (z. B. 20), kürzere Laufzeit
 *   ACTIONS_PER_WALLET=100   # Override Anzahl Aktionen pro Wallet (Default: Quick 20, sonst 250)
 *
 * Voraussetzung: Alle in API_BASES genannten Backends laufen, Wallet je entsperrt, gleiche PACKAGE_ID/RPC.
 */

import 'dotenv/config';

const DEFAULT_PORTS = [3342, 3343, 3344, 3345];
const QUICK = process.env.PARALLEL_STRESS_QUICK === '1' || process.env.PARALLEL_STRESS_QUICK === 'true';
const ACTIONS_PER_WALLET = Math.max(1, parseInt(process.env.ACTIONS_PER_WALLET || (QUICK ? '20' : '250'), 10) || (QUICK ? 20 : 250));
const CMD_TIMEOUT_MS = 70000;
const ONCHAIN_DELAY_MS = Math.max(400, parseInt(process.env.PARALLEL_STRESS_ONCHAIN_DELAY_MS || '600', 10) || 600);
const ADDR_REGEX = /^0x[a-fA-F0-9]{64}$/;

function getApiBases(): string[] {
  const env = (process.env.API_BASES || '').trim();
  if (env) {
    return env.split(',').map((b) => b.trim().replace(/\/$/, '')).filter(Boolean);
  }
  return DEFAULT_PORTS.map((p) => `http://127.0.0.1:${p}`);
}

async function get(base: string, path: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(base + path, { signal: AbortSignal.timeout(10000) });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: r.status, json };
}

async function post(base: string, path: string, data: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(CMD_TIMEOUT_MS),
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: r.status, json };
}

function cmd(base: string, cmdName: string, args: string[] = []): Promise<{ status: number; json: Record<string, unknown> }> {
  return post(base, '/api/command', { cmd: cmdName, args });
}

/** Baut Phase-E-ähnliche Aktionen: create-key, create-ticket, send-plain mit variierenden Parametern. */
function buildPhaseEActions(bossAddress: string, count: number): { cmd: string; args: string[] }[] {
  const actions: { cmd: string; args: string[] }[] = [];
  const validUntilMs = String(Date.now() + 86400000 * 365);
  for (let i = 0; i < count; i++) {
    const ttl = [1, 7, 14, 30, 90][i % 5];
    if (i % 3 === 0) {
      actions.push({ cmd: '/create-key', args: [bossAddress, bossAddress, String(ttl)] });
    } else if (i % 3 === 1) {
      const eventId = '0x' + String(400000 + (i % 1000)).padStart(64, '0').slice(-64);
      actions.push({ cmd: '/create-ticket', args: [eventId, '0', validUntilMs, '0x', bossAddress] });
    } else {
      actions.push({ cmd: '/send-plain', args: [bossAddress, `Parallel-Stress #${i} ${Date.now()}`] });
    }
  }
  return actions;
}

type WorkerResult = { base: string; passed: number; failed: number; durationMs: number; errors: string[] };

async function runWorker(base: string, actions: { cmd: string; args: string[] }[]): Promise<WorkerResult> {
  const start = Date.now();
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];
  const maxErrors = 5;
  for (let i = 0; i < actions.length; i++) {
    const { cmd: c, args } = actions[i];
    try {
      const res = await cmd(base, c, args);
      const ok = res.status === 200 && res.json?.ok !== false;
      if (ok) {
        passed++;
      } else {
        failed++;
        const msg = String(res.json?.message ?? res.json?.error ?? '');
        if (errors.length < maxErrors) errors.push(`${c}: ${msg.slice(0, 80)}`);
      }
    } catch (e) {
      failed++;
      if (errors.length < maxErrors) errors.push(`${c}: ${e instanceof Error ? e.message : String(e)}`);
    }
    const isOnChain = ['/send-plain', '/create-key', '/create-keys', '/create-key-and-notify', '/create-ticket', '/create-tickets'].includes(c);
    if (isOnChain) await new Promise((r) => setTimeout(r, ONCHAIN_DELAY_MS));
    if ((i + 1) % 25 === 0 || i === 0) {
      console.log(`    [${base.replace(/.*\/\/([^/]+)/, '$1')}] ${i + 1}/${actions.length} (ok=${passed}, fail=${failed})`);
    }
  }
  const durationMs = Date.now() - start;
  return { base, passed, failed, durationMs, errors };
}

async function main(): Promise<void> {
  const bases = getApiBases();
  console.log('\n=== 4-Wallet-Parallel-Stresstest ===\n');
  console.log('API_BASES:', bases.length, 'Backend(s):', bases.map((b) => b.replace(/.*\/\/([^/]+)/, '$1')).join(', '));
  console.log('Aktionen pro Wallet:', ACTIONS_PER_WALLET, QUICK ? '(QUICK)' : '');
  console.log('On-Chain-Delay:', ONCHAIN_DELAY_MS, 'ms\n');

  const results: WorkerResult[] = [];
  const startAll = Date.now();

  await Promise.all(
    bases.map(async (base) => {
      try {
        const statusRes = await get(base, '/api/status');
        const status = statusRes.json as { backendRunning?: boolean; locked?: boolean };
        if (!statusRes.ok) {
          results.push({ base, passed: 0, failed: ACTIONS_PER_WALLET, durationMs: 0, errors: [`HTTP ${statusRes.status} – Backend nicht erreichbar`] });
          return;
        }
        if (status.locked === true) {
          results.push({ base, passed: 0, failed: ACTIONS_PER_WALLET, durationMs: 0, errors: ['Wallet gesperrt – bitte im Browser entsperren'] });
          return;
        }
        if (!status.backendRunning) {
          results.push({ base, passed: 0, failed: ACTIONS_PER_WALLET, durationMs: 0, errors: ['Backend nicht bereit (backendRunning=false)'] });
          return;
        }
        const idsRes = await get(base, '/api/current-ids');
        const bossAddress = idsRes.json?.myAddress as string | undefined;
        if (!bossAddress || !ADDR_REGEX.test(bossAddress)) {
          results.push({ base, passed: 0, failed: ACTIONS_PER_WALLET, durationMs: 0, errors: ['MY_ADDRESS fehlt oder ungültig'] });
          return;
        }
        const actions = buildPhaseEActions(bossAddress, ACTIONS_PER_WALLET);
        console.log(`  Starte Wallet ${base.replace(/.*\/\/([^/]+)/, '$1')} (${bossAddress.slice(0, 14)}…) mit ${actions.length} Aktionen …`);
        const result = await runWorker(base, actions);
        results.push(result);
      } catch (e) {
        results.push({
          base,
          passed: 0,
          failed: ACTIONS_PER_WALLET,
          durationMs: 0,
          errors: [e instanceof Error ? e.message : String(e)],
        });
      }
    })
  );

  const totalMs = Date.now() - startAll;
  const totalPassed = results.reduce((s, r) => s + r.passed, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);

  console.log('\n--- Ergebnis ---');
  for (const r of results) {
    const short = r.base.replace(/.*\/\/([^/]+)/, '$1');
    console.log(`  ${short}: passed=${r.passed}, failed=${r.failed}, Dauer=${(r.durationMs / 1000).toFixed(1)} s`);
    if (r.errors.length > 0) for (const err of r.errors) console.log(`    Fehler: ${err}`);
  }
  console.log('  Gesamt: passed=' + totalPassed + ', failed=' + totalFailed + ', Gesamtzeit=' + (totalMs / 1000).toFixed(1) + ' s');
  if (totalFailed > 0) {
    process.exit(1);
  }
  console.log('\n  Alle Aktionen bestanden.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
