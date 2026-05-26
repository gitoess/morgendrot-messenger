/**
 * Wendet ein Rollen-Overlay auf `.env` an (nur ROLE, DEPLOYMENT_PROFILE, UI_VARIANT, …).
 * Secrets (Wallet, RPC, PACKAGE_ID) bleiben in der bestehenden `.env`.
 *
 * Usage: node scripts/activate-role-env.mjs consumer|arbeiter|kommandant|boss
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const ROLES = {
  consumer: 'env/roles/consumer.env',
  arbeiter: 'env/roles/arbeiter.env',
  kommandant: 'env/roles/kommandant.env',
  boss: 'env/roles/boss.env',
};

const role = (process.argv[2] || '').trim().toLowerCase();
const overlayName = ROLES[role];
if (!overlayName) {
  console.error(`[env:role] Unbekannte Rolle: "${role}". Erlaubt: ${Object.keys(ROLES).join(', ')}`);
  process.exit(1);
}

const envPath = path.join(root, '.env');
const overlayPath = path.join(root, overlayName);

if (!fs.existsSync(envPath)) {
  console.error('[env:role] .env fehlt — zuerst aus .env.example anlegen (npm install oder copy).');
  process.exit(1);
}
if (!fs.existsSync(overlayPath)) {
  console.error(`[env:role] Overlay fehlt: ${overlayName}`);
  process.exit(1);
}

/** KEY=VALUE aus Overlay (Kommentare/Leerzeilen ignorieren). */
function parseOverlay(text) {
  const pairs = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    pairs.push([key, value]);
  }
  return pairs;
}

const overlayPairs = parseOverlay(fs.readFileSync(overlayPath, 'utf-8'));
if (overlayPairs.length === 0) {
  console.error('[env:role] Overlay enthält keine KEY=VALUE-Zeilen.');
  process.exit(1);
}

let content = fs.readFileSync(envPath, 'utf-8');
const applied = [];

for (const [key, value] of overlayPairs) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const needQuotes = /[\s#"']|=/.test(value);
  const line = `${key}=${needQuotes ? `"${value.replace(/"/g, '\\"')}"` : value}`;
  const keyMatch = new RegExp(`^\\s*${escaped}\\s*=.*$`, 'm');
  if (keyMatch.test(content)) {
    content = content.replace(keyMatch, line);
  } else {
    content = content.trimEnd() + (content.endsWith('\n') ? '' : '\n') + `\n# Rollen-Overlay (${role})\n${line}\n`;
  }
  applied.push(`${key}=${value}`);
}

fs.writeFileSync(envPath, content, 'utf-8');
console.log(`[env:role] ${role} → .env aktualisiert:`);
for (const a of applied) console.log(`  ${a}`);
console.log('[env:role] Backend neu starten (npm run dev), dann GET /api/status prüfen (role, deploymentProfile, permissions).');
