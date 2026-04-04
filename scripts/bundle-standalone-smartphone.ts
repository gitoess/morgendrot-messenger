/**
 * Erzeugt exports/morgendrot-standalone-smartphone:
 * - Backend: src/ (API, Wallet-Bridge)
 * - UI: frontend/ (Next.js), ohne .next / node_modules / Tests
 *
 * Installation im Zielordner: npm install --omit=dev (Root + frontend), siehe README im Bundle.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'exports', 'morgendrot-standalone-smartphone');

/** Verzeichnisse, die nicht kopiert werden (Namensgleichheit). */
const EXCLUDE_DIR_NAMES = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'e2e',
  'test-results',
  'playwright-report',
  'coverage',
  'tmp',
  '.git',
]);

function rmrf(p: string) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function copyDirFiltered(from: string, to: string, opts?: { skipRootFiles?: (name: string) => boolean }) {
  if (!fs.existsSync(from)) throw new Error('Fehlt: ' + from);
  fs.mkdirSync(to, { recursive: true });
  const entries = fs.readdirSync(from, { withFileTypes: true });
  for (const ent of entries) {
    const src = path.join(from, ent.name);
    const dest = path.join(to, ent.name);
    if (ent.isDirectory()) {
      if (EXCLUDE_DIR_NAMES.has(ent.name)) continue;
      copyDirFiltered(src, dest, opts);
      continue;
    }
    if (ent.isFile() && opts?.skipRootFiles?.(ent.name)) continue;
    if (ent.isFile() && /^\.env(\.|$)/.test(ent.name) && ent.name !== '.env.example') continue;
    fs.copyFileSync(src, dest);
  }
}

function mergeFrontendPackageJson(raw: Record<string, unknown>): Record<string, unknown> {
  const deps = { ...((raw.dependencies as Record<string, string>) || {}) };
  const devDeps = { ...((raw.devDependencies as Record<string, string>) || {}) };
  /** Für next build / Tailwind: mit npm install --omit=dev verfügbar. */
  const promote = [
    'typescript',
    'tailwindcss',
    'postcss',
    '@tailwindcss/postcss',
    'tw-animate-css',
    '@types/node',
    '@types/react',
    '@types/react-dom',
    '@types/qrcode',
    /** globals.css importiert shadcn/tailwind.css – Build braucht das Paket. */
    'shadcn',
  ] as const;
  for (const k of promote) {
    if (devDeps[k]) {
      deps[k] = devDeps[k];
      delete devDeps[k];
    }
  }
  const scripts = { ...((raw.scripts as Record<string, string>) || {}) };
  scripts['dev:lan'] = 'next dev --port 3341 --hostname 0.0.0.0';
  scripts['start:lan'] = 'next start --hostname 0.0.0.0 --port 3341';

  return {
    ...raw,
    dependencies: deps,
    devDependencies: devDeps,
    scripts,
  };
}

function buildRootPackageJson(): Record<string, unknown> {
  const pkgPath = path.join(REPO, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
  const rootDeps = (pkg.dependencies as Record<string, string>) || {};
  const rootDev = (pkg.devDependencies as Record<string, string>) || {};
  const sharpVer = rootDev.sharp || '^0.33.5';

  return {
    name: 'morgendrot-standalone-smartphone',
    version: pkg.version || '0.1.0',
    private: true,
    type: 'module',
    description:
      'Morgendrot Messenger: Next.js UI (frontend/) + API (src/). PWA/Android-Tests; später CM4. Siehe README.md.',
    scripts: {
      'start:api': 'tsx src/start-with-secrets.ts',
      'dev:next': 'npm run dev --prefix frontend',
      dev: 'concurrently --names "api,next" -c "cyan,magenta" "npm run start:api" "npm run dev:next"',
      'dev:lan':
        'concurrently --names "api,next" -c "cyan,magenta" "npm run start:api" "npm run dev:lan --prefix frontend"',
      'build:next': 'npm run build --prefix frontend',
      'start:next': 'npm run start --prefix frontend',
      'start:prod':
        'concurrently --names "api,next" -c "cyan,magenta" "npm run start:api" "npm run start:next"',
      'start:prod:lan':
        'concurrently --names "api,next" -c "cyan,magenta" "npm run start:api" "npm run start:lan --prefix frontend"',
      'encrypt-env': 'tsx scripts/encrypt-env.ts',
    },
    dependencies: {
      ...rootDeps,
      sharp: sharpVer,
      concurrently: '^9.1.0',
    },
  };
}

function envExampleSmartphone(): string {
  return [
    '# =============================================================================',
    '# Morgendrot Standalone Smartphone / PWA (Next.js + API)',
    '# =============================================================================',
    '# Kopie als .env und Werte setzen (keine Secrets ins Repo).',
    '#',
    '# UI: http://127.0.0.1:3341  ·  API: http://127.0.0.1:3342 (Next leitet /api → API)',
    '#',
    '# Android im LAN: npm run dev:lan im Bundle-Root (Next auf 0.0.0.0:3341),',
    '#   oder USB: adb reverse tcp:3341 tcp:3341 && adb reverse tcp:3342 tcp:3342',
    '#',
    '# =============================================================================',
    '',
    'ENABLE_UI=true',
    'UI_VARIANT=full',
    'ROLE=messenger',
    'ROLE_ID=14',
    'API_PORT=3342',
    'API_KILL_PREVIOUS_INSTANCE=true',
    'SIGNER=cli',
    'RPC_URL=https://api.testnet.iota.cafe',
    'NETWORK_TRUST_TIER=1',
    'PACKAGE_ID=',
    'MY_ADDRESS=',
    '# Optional: verschlüsselte Zusatz-Env – siehe encrypt-env im README',
    '# ENCRYPTED_ENV_FILE=.env.secrets.enc',
    '',
  ].join('\n');
}

function readmeSmartphone(): string {
  return `# Morgendrot Standalone Smartphone (Next.js + API)

**Inhalt:** Vollständige **Next.js-Oberfläche** (\`frontend/\`) und **Backend-API** (\`src/\`) wie im Haupt-Repository – ohne Lite-UI (\`ui/\`). Gedacht für **Android (PWA / Chrome)** mit Heltec per **Web Bluetooth**, später dieselbe PWA auf **CM4**.

## Voraussetzungen

- **Node.js** LTS (20+)
- **Keine** mitgelieferte \`.env\` / kein Vault (nur \`.env.example\`); Geheimnisse nur lokal setzen.

## Installation (Production-Dependencies)

Im **Wurzelverzeichnis** dieses Ordners (neben \`package.json\`):

\`\`\`bash
npm install --omit=dev
cd frontend
npm install --omit=dev
cd ..
\`\`\`

Tailwind/TypeScript/PostCSS und **shadcn** (für \`shadcn/tailwind.css\` in \`globals.css\`) sind in der exportierten \`frontend/package.json\` unter **dependencies** geführt, damit \`npm install --omit=dev\` für einen **Next-Build** ausreicht.

**Hinweis:** Bundle erneut erzeugen (\`npm run bundle:standalone-smartphone\`): Zielordner muss löschbar sein (kein offenes Terminal im Ordner, ggf. \`node_modules\`-Sperre beenden).

## Erster Build der Next-App

\`\`\`bash
npm run build:next
\`\`\`

Ergebnis: \`frontend/.next/\` (lokal, nicht im ZIP-Export des Repos).

## Start (Entwicklung)

Zwei Prozesse: API (3342) + Next (3341).

\`\`\`bash
npm run dev
\`\`\`

- **UI:** http://127.0.0.1:3341  
- **API:** http://127.0.0.1:3342  

\`.env\` aus \`.env.example\` anlegen; Wallet/Tresor wie im Hauptprojekt.

### Android-Telefon im selben WLAN

Standard bindet Next nur an \`127.0.0.1\`. Für Zugriff vom Handy:

\`\`\`bash
npm run dev:lan
\`\`\`

(Port 3341 auf \`0.0.0.0\`; Firewall beachten.)

**Alternative USB:** \`adb reverse tcp:3341 tcp:3341\` und \`adb reverse tcp:3342 tcp:3342\`, dann am Handy http://127.0.0.1:3341 .

## Start (Production)

\`\`\`bash
npm run build:next
npm run start:prod
\`\`\`

Für Zugriff im LAN auf die gebaute UI: \`npm run start:prod:lan\` (Next auf \`0.0.0.0:3341\`).

## PWA / CM4

- **PWA (Haupt-Repo \`frontend/\`):** \`app/manifest.ts\` → **installierbar** (Chrome/Android: „Zum Startbildschirm hinzufügen“). \`public/sw.js\` cached nur **\`/_next/static/**\` (JS/CSS nach erstem Laden) – **API (\`/api\`) braucht weiter Netz** zum Backend-Proxy. Erste Ladung ohne Server: nicht möglich. SW-Registrierung nur in **Production** (\`next build\` + \`next start\`), nicht im \`next dev\`.
- **CM4:** Gleiche Schritte unter Linux (Node LTS); optional systemd-Units für \`start:api\` und \`start:next\` mit \`HOSTNAME=0.0.0.0\`.

## Sicherheit

Keine \`.env\`, keine \`.morgendrot-vault*\`-Dateien aus dem Build-PC ins Archiv packen – nur \`.env.example\` und dieser README folgen dem Bundle-Skript.

## Unterschied zu \`exports/Morgendrot-Messenger-standalone\`

Dort: Lite-UI \`ui/index.html\`, kleineres Paket. **Hier:** volle **Next.js**-Oberfläche aus \`frontend/\`.
`;
}

function gitignoreBundle(): string {
  return [
    'node_modules/',
    'frontend/node_modules/',
    'frontend/.next/',
    '.env',
    '.env.*',
    '!.env.example',
    '.morgendrot-vault',
    '.morgendrot-vault.*',
    '*.log',
    'tmp/',
  ].join('\n');
}

async function main() {
  console.log('Bundle →', OUT);
  rmrf(OUT);
  fs.mkdirSync(OUT, { recursive: true });

  copyDirFiltered(path.join(REPO, 'src'), path.join(OUT, 'src'));
  copyDirFiltered(path.join(REPO, 'frontend'), path.join(OUT, 'frontend'));

  fs.copyFileSync(path.join(REPO, 'tsconfig.json'), path.join(OUT, 'tsconfig.json'));

  const enc = path.join(REPO, 'scripts', 'encrypt-env.ts');
  if (fs.existsSync(enc)) {
    const sdir = path.join(OUT, 'scripts');
    fs.mkdirSync(sdir, { recursive: true });
    fs.copyFileSync(enc, path.join(sdir, 'encrypt-env.ts'));
  }

  const fePkgPath = path.join(OUT, 'frontend', 'package.json');
  const fePkg = JSON.parse(fs.readFileSync(fePkgPath, 'utf8')) as Record<string, unknown>;
  fs.writeFileSync(fePkgPath, JSON.stringify(mergeFrontendPackageJson(fePkg), null, 2) + '\n', 'utf8');

  fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify(buildRootPackageJson(), null, 2) + '\n', 'utf8');

  fs.writeFileSync(path.join(OUT, '.env.example'), envExampleSmartphone(), 'utf8');
  fs.writeFileSync(path.join(OUT, 'README.md'), readmeSmartphone(), 'utf8');
  fs.writeFileSync(path.join(OUT, '.gitignore'), gitignoreBundle(), 'utf8');

  console.log('Fertig:', OUT);
  console.log('Nächste Schritte im Zielordner: npm install --omit=dev && cd frontend && npm install --omit=dev && cd .. && npm run build:next');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
