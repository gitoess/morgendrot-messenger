/**
 * Bootstrap: erzeugt C:\Users\<user>\Desktop\iota-messenger als eigenständiges Projekt.
 *
 * Ausführen im Morgendrot-Repo:
 *   node tools/iota-messenger/bootstrap-desktop.mjs
 *
 * Optional: Zielpfad als Argument.
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '../..')
const TOOL = path.join(__dirname)
const DEFAULT_DEST = path.join(os.homedir(), 'Desktop', 'iota-messenger')
const DEST = path.resolve(process.argv[2] || DEFAULT_DEST)

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
])

function rmrf(p) {
  if (!fs.existsSync(p)) return
  fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

function copyDirFiltered(from, to) {
  if (!fs.existsSync(from)) throw new Error('Fehlt: ' + from)
  fs.mkdirSync(to, { recursive: true })
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, ent.name)
    const dest = path.join(to, ent.name)
    if (ent.isDirectory()) {
      if (EXCLUDE_DIR_NAMES.has(ent.name)) continue
      copyDirFiltered(src, dest)
      continue
    }
    if (ent.isFile() && /^\.env(\.|$)/.test(ent.name) && ent.name !== '.env.example') continue
    fs.copyFileSync(src, dest)
  }
}

function mergeFrontendPackageJson(raw) {
  const deps = { ...(raw.dependencies || {}) }
  const devDeps = { ...(raw.devDependencies || {}) }
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
    'shadcn',
  ]
  for (const k of promote) {
    if (devDeps[k]) {
      deps[k] = devDeps[k]
      delete devDeps[k]
    }
  }
  return {
    ...raw,
    name: 'iota-messenger-frontend',
    dependencies: deps,
    devDependencies: devDeps,
    scripts: {
      ...(raw.scripts || {}),
      'dev:lan': 'next dev --port 3341 --hostname 0.0.0.0',
      'start:lan': 'next start --hostname 0.0.0.0 --port 3341',
    },
  }
}

function buildRootPackageJson() {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'))
  const rootDeps = pkg.dependencies || {}
  const rootDev = pkg.devDependencies || {}
  let upstreamCommit = 'unknown'
  try {
    upstreamCommit = execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
  } catch {
    /* ignore */
  }

  return {
    name: 'iota-messenger',
    version: '0.1.0',
    private: true,
    type: 'module',
    description:
      'IOTA Messenger — Wallet, Mailbox-Chat, Gruppen, IOTA-Transfer. Eigenständiges Projekt (abgeleitet von Morgendrot).',
    upstream: {
      repository: 'morgendrot-messenger',
      commit: upstreamCommit,
      bootstrappedAt: new Date().toISOString().slice(0, 10),
    },
    scripts: {
      postinstall: 'node scripts/ensure-env.mjs',
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
      'apply:patches': 'node scripts/apply-product-patches.mjs',
      'bootstrap:resync': 'node scripts/bootstrap-from-morgendrot.mjs',
    },
    dependencies: {
      ...rootDeps,
      '@morgendrot/shared': 'file:src/shared',
      sharp: rootDev.sharp || '^0.33.5',
      concurrently: '^9.1.0',
    },
    license: 'AGPL-3.0-or-later',
    overrides: {
      '@iota/iota-sdk': '^1.11.0',
    },
  }
  }
}

function gitignoreBundle() {
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
  ].join('\n')
}

function copyScripts(dest) {
  const sdir = path.join(dest, 'scripts')
  fs.mkdirSync(sdir, { recursive: true })
  for (const name of ['ensure-env.mjs', 'encrypt-env.ts']) {
    const src = path.join(REPO, 'scripts', name)
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sdir, name))
  }
  fs.copyFileSync(
    path.join(TOOL, 'patches', 'apply-ui-patches.mjs'),
    path.join(sdir, 'apply-product-patches.mjs')
  )
  fs.copyFileSync(path.join(TOOL, 'bootstrap-from-morgendrot.mjs'), path.join(sdir, 'bootstrap-from-morgendrot.mjs'))
}

function copyLicense(dest) {
  for (const name of ['LICENSE', 'DISCLAIMER.md']) {
    const src = path.join(REPO, name)
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, name))
  }
}

function main() {
  console.log('IOTA Messenger Bootstrap')
  console.log('  Quelle:', REPO)
  console.log('  Ziel:  ', DEST)

  if (fs.existsSync(DEST)) {
    console.log('  Lösche bestehendes Ziel…')
    rmrf(DEST)
  }
  fs.mkdirSync(DEST, { recursive: true })

  copyDirFiltered(path.join(REPO, 'src'), path.join(DEST, 'src'))
  copyDirFiltered(path.join(REPO, 'frontend'), path.join(DEST, 'frontend'))
  copyDirFiltered(path.join(REPO, 'packages', 'morgendrot-core'), path.join(DEST, 'packages', 'morgendrot-core'))

  if (fs.existsSync(path.join(REPO, 'tsconfig.json'))) {
    fs.copyFileSync(path.join(REPO, 'tsconfig.json'), path.join(DEST, 'tsconfig.json'))
  }

  copyScripts(DEST)
  copyLicense(DEST)

  const productDir = path.join(DEST, 'product')
  copyDirFiltered(path.join(TOOL, 'overlays'), path.join(productDir, 'overlays'))
  copyDirFiltered(path.join(TOOL, 'patches'), path.join(productDir, 'patches'))

  const fePkgPath = path.join(DEST, 'frontend', 'package.json')
  const fePkg = JSON.parse(fs.readFileSync(fePkgPath, 'utf8'))
  fs.writeFileSync(fePkgPath, JSON.stringify(mergeFrontendPackageJson(fePkg), null, 2) + '\n', 'utf8')

  fs.writeFileSync(path.join(DEST, 'package.json'), JSON.stringify(buildRootPackageJson(), null, 2) + '\n', 'utf8')

  const overlays = path.join(TOOL, 'overlays')
  fs.copyFileSync(path.join(overlays, '.env.example'), path.join(DEST, '.env.example'))
  fs.copyFileSync(path.join(overlays, '.morgendrot-runtime-config.json'), path.join(DEST, '.morgendrot-runtime-config.json'))
  fs.writeFileSync(path.join(DEST, 'README.md'), fs.readFileSync(path.join(overlays, 'README.md'), 'utf8'))
  fs.writeFileSync(path.join(DEST, 'UPSTREAM.md'), fs.readFileSync(path.join(overlays, 'UPSTREAM.md'), 'utf8'))
  fs.writeFileSync(path.join(DEST, '.gitignore'), gitignoreBundle(), 'utf8')

  console.log('  Patches anwenden…')
  execSync(`node "${path.join(DEST, 'scripts', 'apply-product-patches.mjs')}" "${DEST}"`, {
    stdio: 'inherit',
  })

  try {
    execSync('git init', { cwd: DEST, stdio: 'inherit' })
  } catch {
    console.warn('  git init fehlgeschlagen — manuell ausführen.')
  }

  console.log('\nFertig:', DEST)
  console.log('Nächste Schritte:')
  console.log('  cd', DEST)
  console.log('  npm install && cd frontend && npm install && cd ..')
  console.log('  cp .env.example .env  # PACKAGE_ID + MAILBOX_ID setzen')
  console.log('  npm run dev')
}

main()
