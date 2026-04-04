/**
 * Kompletter Real-World-Test auf einem PC (oder mit zwei Instanzen).
 * Führt nacheinander aus:
 *   1. Boss-Szenario (ein Wallet: Arbeiter, Rebate, Heartbeat, Nachrichten, Streams, Vault, …)
 *   2. Optional: Alle Kacheln / Nachrichten (wenn API_BASE_B gesetzt = zweites Backend)
 *
 * Voraussetzung: Mindestens ein Backend läuft (z. B. npm run start:secrets), Wallet entsperrt.
 *
 * Aufruf:
 *   npm run test:full-realworld
 *   API_BASE_B=http://127.0.0.1:3343 npm run test:full-realworld   # mit zweiter Instanz
 *
 * Env: API_URL (default 127.0.0.1:3342), API_BASE_A, API_BASE_B (für 2-Wallet-Tests)
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function run(name: string, script: string): boolean {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + name);
  console.log('='.repeat(60));
  try {
    execSync(script, { cwd: root, stdio: 'inherit', shell: true });
    console.log('[OK] ' + name + '\n');
    return true;
  } catch (e) {
    console.error('[FAIL] ' + name + '\n');
    return false;
  }
}

async function main() {
  console.log('Morgendrot – Vollständiger Real-World-Test');
  console.log('Ein PC: ein Backend (z. B. Port 3342). Zwei PCs/Ports: API_BASE_A + API_BASE_B setzen.\n');

  let passed = 0;
  let failed = 0;

  // 1) Ein-Wallet: Boss-Szenario (Arbeiter, Keys, Rebate, Heartbeat, Nachrichten, Vault, Purge, …)
  if (run('1. Boss-Szenario (ein Wallet)', 'npx tsx scripts/run-boss-realworld-scenario.ts')) passed++;
  else failed++;

  // 2) Optional: Zwei Wallets – alle Kacheln oder Nachrichten
  const apiB = process.env.API_BASE_B;
  if (apiB) {
    if (run('2. Alle Kacheln (2 Wallets)', 'npx tsx scripts/run-all-9-tiles-realworld.ts')) passed++;
    else failed++;
  } else {
    console.log('\n[Skip] 2. Alle Kacheln – API_BASE_B nicht gesetzt (nur ein Backend).');
    console.log('       Für 2-Wallet-Test: API_BASE_A=http://127.0.0.1:3342 API_BASE_B=http://127.0.0.1:3343 npm run test:full-realworld\n');
  }

  console.log('\n' + '='.repeat(60));
  console.log('  Ergebnis: ' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
