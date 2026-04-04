/**
 * Setzt PACKAGE_ID im laufenden Backend (POST /api/config) und führt danach den Tiles-Quick-Test aus.
 * Quelle (in Reihenfolge): Umgebungsvariable PACKAGE_ID, dann .morgendrot-package-id.
 * Wenn die Datei die Sender-Adresse (0x671b…) enthält statt der echten Package-ID, wird die
 * zuletzt bekannte Publish-Package-ID verwendet und die Datei korrigiert.
 *
 * Voraussetzung: Backend läuft (z. B. Port 3342), Wallet entsperrt.
 * Mit --with-backend: Backend auf Port 3346 starten (frischer Code). Hinweis: Wallet muss dort entsperrt sein (Befehl-Handler bereit), sonst alle Befehle „nicht bereit“. Für /send-plain-Fix: bestehendes Backend einmal neu starten, dann Test ohne --with-backend.
 *
 *   npx tsx scripts/set-package-id-then-tiles.ts
 *   npx tsx scripts/set-package-id-then-tiles.ts --with-backend
 *   PACKAGE_ID=0x… npx tsx scripts/set-package-id-then-tiles.ts
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3342;
const WITH_BACKEND_PORT = 3346; // Eigenen Port für --with-backend, damit kein laufendes Backend getroffen wird
const API_BASE = (process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '');
const WITH_BACKEND = process.argv.includes('--with-backend') || process.env.BACKEND_AUTO_START === '1';
const PACKAGE_ID_FILE = process.env.PACKAGE_ID_FILE || '.morgendrot-package-id';
const ROOT = resolve(__dirname, '..');
const PACKAGE_ID_REGEX = /^0x[a-fA-F0-9]{64}$/;

/** Sender-Adresse, die oft fälschlich als Package-ID gespeichert wird („Dependent package not found“). */
const SENDER_ADDRESS_AS_BAD_PACKAGE = '0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5'.toLowerCase();
/** Echte Package-ID nach iota client publish (Publish-Output: Published Objects → PackageID). */
const KNOWN_PUBLISHED_PACKAGE_ID = '0xd0911511a1d4dbf0e375dd8eb861243beb10df8f6ae1629a874f331e6e208b7e';

function isBadSenderAsPackage(id: string): boolean {
  return (id || '').trim().toLowerCase() === SENDER_ADDRESS_AS_BAD_PACKAGE;
}

function getPackageId(): { id: string; from: string } {
  const fromEnv = (process.env.PACKAGE_ID || '').trim();
  if (PACKAGE_ID_REGEX.test(fromEnv) && !isBadSenderAsPackage(fromEnv)) return { id: fromEnv, from: 'env' };
  if (isBadSenderAsPackage(fromEnv)) {
    console.log('Hinweis: PACKAGE_ID in der Umgebung ist die Sender-Adresse (0x671b…), nicht die Package-ID. Verwende Publish-Package-ID.');
  }

  const p = resolve(ROOT, PACKAGE_ID_FILE);
  if (existsSync(p)) {
    const id = readFileSync(p, 'utf-8').trim();
    if (PACKAGE_ID_REGEX.test(id)) {
      if (isBadSenderAsPackage(id)) {
        try {
          writeFileSync(p, KNOWN_PUBLISHED_PACKAGE_ID + '\n', 'utf-8');
          console.log('Hinweis: In', PACKAGE_ID_FILE, 'stand die Sender-Adresse (0x671b…) statt der Package-ID. Datei auf Publish-Package-ID korrigiert.');
        } catch {}
        return { id: KNOWN_PUBLISHED_PACKAGE_ID, from: 'file (korrigiert)' };
      }
      return { id, from: 'file' };
    }
  }
  return { id: KNOWN_PUBLISHED_PACKAGE_ID, from: 'default (Publish-Package-ID)' };
}

async function waitForBackend(baseUrl: string, maxMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(baseUrl + '/api/config', { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (r.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Backend nicht erreichbar innerhalb von ' + maxMs + ' ms.');
}

async function main() {
  let backendProc: ReturnType<typeof spawn> | null = null;
  let apiBaseForRun = API_BASE;
  if (WITH_BACKEND) {
    console.log('Starte Backend (frischer Code) auf Port', WITH_BACKEND_PORT, '…');
    const root = resolve(__dirname, '..');
    apiBaseForRun = `http://127.0.0.1:${WITH_BACKEND_PORT}`;
    backendProc = spawn('npx', ['tsx', 'src/start-with-secrets.ts'], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0', API_PORT: String(WITH_BACKEND_PORT), UI_PORT: String(WITH_BACKEND_PORT + 1) },
      shell: true,
    });
    backendProc.stdout?.on('data', (d) => process.stdout.write(d));
    backendProc.stderr?.on('data', (d) => process.stderr.write(d));
    try {
      await waitForBackend(apiBaseForRun, 15000);
    } catch {
      const fallback = `http://127.0.0.1:${WITH_BACKEND_PORT + 1}`;
      console.log('Port', WITH_BACKEND_PORT, 'nicht erreichbar, versuche', WITH_BACKEND_PORT + 1, '…');
      await waitForBackend(fallback, 20000);
      apiBaseForRun = fallback;
    }
    console.log('Backend bereit.\n');
  }

  const { id: packageId, from } = getPackageId();
  if (!packageId) {
    console.error('Keine gültige Package-ID (0x + 64 Hex). Setze PACKAGE_ID in der Umgebung oder in', PACKAGE_ID_FILE);
    if (backendProc) backendProc.kill();
    process.exit(1);
  }

  const base = WITH_BACKEND ? apiBaseForRun : API_BASE;
  console.log('Setze PACKAGE_ID im Backend:', packageId.slice(0, 18) + '…', '(' + from + ')');
  let res: Response;
  try {
    res = await fetch(base + '/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'PACKAGE_ID', value: packageId.trim() }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err: unknown) {
    const e = err as { cause?: { code?: string }; code?: string; message?: string };
    const code = e?.cause?.code ?? e?.code;
    const msg = String(e?.message ?? e?.cause ?? e);
    if (code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
      console.error('\nBackend nicht erreichbar unter', API_BASE + '.');
      console.error('Bitte zuerst Backend starten (z. B. npm run start:secrets), Wallet entsperren, dann dieses Skript erneut ausführen.');
      process.exit(1);
    }
    throw err;
  }
  const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
  if (!res.ok || json.ok === false) {
    console.error('Config setzen fehlgeschlagen:', res.status, json.error || json);
    process.exit(1);
  }
  console.log('PACKAGE_ID gesetzt. Starte Tiles-Test (TILES_QUICK=1) …\n');

  process.env.TILES_DRY_RUN = '0';
  process.env.TILES_QUICK = '1';
  if (WITH_BACKEND) process.env.API_BASE = apiBaseForRun;
  const { execSync } = await import('node:child_process');
  try {
    execSync('npm run test:tiles-combinations', { cwd: ROOT, stdio: 'inherit', shell: true, env: { ...process.env, API_BASE: WITH_BACKEND ? apiBaseForRun : process.env.API_BASE } });
  } catch (e: unknown) {
    const code = (e as { status?: number }).status;
    if (backendProc) backendProc.kill();
    process.exit(typeof code === 'number' ? code : 1);
  }
  if (backendProc) {
    console.log('\nBackend wird beendet (--with-backend).');
    backendProc.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
