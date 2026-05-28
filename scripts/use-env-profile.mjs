/**
 * Schaltet zwischen Messenger- und Monitor-Env um.
 * - monitor: sichert aktuelle `.env` als letztes Messenger-Profil und aktiviert `env/monitor.env`
 * - messenger: stellt das zuletzt gesicherte Messenger-Profil wieder her
 *
 * Usage:
 *   node scripts/use-env-profile.mjs monitor
 *   node scripts/use-env-profile.mjs messenger
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const MONITOR_PROFILE = 'env/monitor.env';
const LAST_MESSENGER_ENV = '.env.profile-messenger.last';

const profile = (process.argv[2] || '').trim().toLowerCase();
if (!['monitor', 'messenger'].includes(profile)) {
  console.error('[env:use] Unbekanntes Profil. Erlaubt: monitor, messenger');
  process.exit(1);
}

const envPath = path.join(root, '.env');
const monitorPath = path.join(root, MONITOR_PROFILE);
const messengerBackupPath = path.join(root, LAST_MESSENGER_ENV);

if (profile === 'monitor') {
  if (!fs.existsSync(monitorPath)) {
    console.error(`[env:use] Profil-Datei fehlt: ${MONITOR_PROFILE}`);
    process.exit(1);
  }
  if (!fs.existsSync(envPath)) {
    console.error('[env:use] .env fehlt, monitor kann nicht aktiviert werden.');
    process.exit(1);
  }

  // Letztes funktionsfaehiges Messenger-Env fuer den Rueckweg sichern.
  fs.copyFileSync(envPath, messengerBackupPath);
  console.log(`[env:use] Rueckweg gespeichert: ${LAST_MESSENGER_ENV}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(root, `.env.backup-auto-${stamp}`);
  fs.copyFileSync(envPath, backupPath);
  console.log(`[env:use] Backup erstellt: ${path.basename(backupPath)}`);

  fs.copyFileSync(monitorPath, envPath);
  console.log(`[env:use] Aktiv: ${MONITOR_PROFILE} -> .env`);
  console.log('[env:use] Bitte Backend/Dev-Server neu starten.');
  process.exit(0);
}

if (!fs.existsSync(messengerBackupPath)) {
  console.error(`[env:use] Kein Rueckweg gefunden (${LAST_MESSENGER_ENV}). Erst "npm run env:use:monitor" ausfuehren oder .env manuell wiederherstellen.`);
  process.exit(1);
}

if (fs.existsSync(envPath)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(root, `.env.backup-auto-${stamp}`);
  fs.copyFileSync(envPath, backupPath);
  console.log(`[env:use] Backup erstellt: ${path.basename(backupPath)}`);
}

fs.copyFileSync(messengerBackupPath, envPath);
console.log(`[env:use] Aktiv: ${LAST_MESSENGER_ENV} -> .env`);
console.log('[env:use] Bitte Backend/Dev-Server neu starten.');
