/**
 * Stellt morgendrot/.env wieder auf **lokale Daten im Repo** um.
 * Der Modus-A-Feldtest darf eine eigene .env im Sibling-Ordner haben — nicht diese Datei überschreiben.
 *
 * Usage: node scripts/restore-morgendrot-env-local.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const backupPath = path.join(root, '.env.modus-a-feldtest.backup');

const FELDTEST_MARKER = 'morgendrot-modus-a-feldtest';

function readPkgFromFile() {
  const p = path.join(root, '.morgendrot-package-id');
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf-8').trim();
}

function readGlobalsIds() {
  const p = path.join(root, '.morgendrot-globals-ids.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

if (!fs.existsSync(envPath)) {
  console.error('[restore-env] .env fehlt — zuerst aus .env.example kopieren.');
  process.exit(1);
}

const before = fs.readFileSync(envPath, 'utf-8');
if (before.includes(FELDTEST_MARKER)) {
  fs.writeFileSync(backupPath, before, 'utf-8');
  console.log(`[restore-env] Backup: ${path.basename(backupPath)}`);
} else {
  console.log('[restore-env] Kein Feldtest-Pfad in .env — nichts zu tun.');
  process.exit(0);
}

const pkg = readPkgFromFile();
const globals = readGlobalsIds();
const mailbox = globals?.mailboxId?.trim() || '';
const vaultReg = globals?.vaultRegistryId?.trim() || '';
const cmdReg = globals?.commandRegistryId?.trim() || '';

const lines = [
  '# Morgendrot — lokale Entwicklung (Repo-Wurzel)',
  '# Daten: .morgendrot-vault, .morgendrot-package-id im Repo (nicht Feldtest-Ordner).',
  '# Feldtest: eigener Ordner + eigene .env — siehe docs/FELDTEST-BOSS-BEI-0.md',
  '',
  'RPC_URL=https://api.testnet.iota.cafe',
  'NETWORK_TRUST_TIER=1',
  '',
  pkg ? `PACKAGE_ID=${pkg}` : '# PACKAGE_ID=  # aus .morgendrot-package-id beim Start',
  'PACKAGE_ID_FILE=.morgendrot-package-id',
  mailbox ? `MAILBOX_ID=${mailbox}` : '# MAILBOX_ID=',
  vaultReg ? `VAULT_REGISTRY_ID=${vaultReg}` : '# VAULT_REGISTRY_ID=',
  cmdReg ? `COMMAND_REGISTRY_ID=${cmdReg}` : '# COMMAND_REGISTRY_ID=',
  '# MY_ADDRESS kommt aus .morgendrot-vault nach Tresor-Entsperren',
  '',
  'ROLE=boss',
  'ROLE_ID=14',
  'DEPLOYMENT_PROFILE=einsatz',
  'UI_VARIANT=full',
  'TRANSPORT_PROFILE=iota-full',
  'SIMPLE_MODE=false',
  'MESSENGER_EDITION=standalone',
  '',
  'VAULT_FILE=.morgendrot-vault',
  'PARTNER_ADDRESS_FILE=.morgendrot-partner',
  'REPLAY_STATE_FILE=.morgendrot-replay-state',
  '',
  'USE_MAILBOX=true',
  'MAILBOX_STORE_PLAINTEXT=true',
  'ENABLE_PLAINTEXT_CHANNEL=false',
  'ENABLE_PURGE=true',
  'ENABLE_LISTENER=true',
  'ENABLE_FETCH_COMMAND=true',
  'FETCH_LAST_ON_START=0',
  'SIGNER=sdk',
  'ENABLE_UI=true',
  '',
  'API_PORT=3342',
  'UI_PORT=3341',
  'API_BIND_HOST=0.0.0.0',
  'MORGENDROT_API_INTERNAL_URL=http://127.0.0.1:3342',
  '',
  'ENABLE_MONITOR=false',
  'ENABLE_HEARTBEAT=false',
  '',
];

fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
console.log('[restore-env] .env → lokale Pfade (.morgendrot-vault im Repo).');
if (pkg) console.log(`[restore-env] PACKAGE_ID aus Datei: ${pkg.slice(0, 14)}…`);
if (mailbox) console.log(`[restore-env] MAILBOX_ID aus .morgendrot-globals-ids.json`);
console.log('[restore-env] Nächster Schritt: npm run dm → Tresor mit bisherigem Passwort entsperren.');
