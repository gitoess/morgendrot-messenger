/**
 * Wartet, bis die API erreichbar ist, und führt danach einmal seed:ui aus.
 * Für einen einzigen Befehl „alles starten inkl. UI-Befüllung“:
 *   npm run dev:with-seed
 *
 * Nutzt API_URL (Default http://127.0.0.1:3342) und max. 90 s Wartezeit.
 */

const BASE = process.env.API_URL || 'http://127.0.0.1:3342';
const MAX_WAIT_MS = 90_000;
const POLL_MS = 800;

async function waitForApi(): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      const r = await fetch(BASE + '/api/status');
      if (r.ok) return true;
    } catch {
      // ECONNREFUSED etc. – weiter warten
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return false;
}

async function main() {
  console.log('Warte auf API', BASE, '…');
  const ok = await waitForApi();
  if (!ok) {
    console.error('API nach', MAX_WAIT_MS / 1000, 's nicht erreichbar. Backend starten: npm run start:secrets');
    process.exit(1);
  }
  console.log('API erreichbar. Führe seed:ui aus …\n');
  const { execSync } = await import('node:child_process');
  execSync('npm run seed:ui', { stdio: 'inherit', cwd: process.cwd() });
}

main();
