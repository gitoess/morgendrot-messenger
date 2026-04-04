/**
 * Kopiert exports/Morgendrot-Messenger-standalone nach ~/Desktop/Morgendrot-Messenger
 * (Windows/macOS/Linux: os.homedir()/Desktop).
 *
 * Zuerst Bundle erzeugen: npm run bundle:messenger
 * Oder kombiniert: npm run messenger:desktop
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'exports', 'Morgendrot-Messenger-standalone');
const DEST_NAME = 'Morgendrot-Messenger';
const DESKTOP = path.join(os.homedir(), 'Desktop');
const DEST = path.join(DESKTOP, DEST_NAME);

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Bundle fehlt:', SRC);
    console.error('Zuerst ausführen: npm run bundle:messenger');
    process.exit(1);
  }
  if (!fs.existsSync(DESKTOP)) {
    console.error('Desktop-Ordner nicht gefunden:', DESKTOP);
    console.error('Ziel manuell setzen: Ordner exports/Morgendrot-Messenger-standalone kopieren.');
    process.exit(1);
  }
  try {
    fs.rmSync(DEST, { recursive: true, force: true });
  } catch (e) {
    console.warn('Konnte altes Ziel nicht löschen (evtl. geöffnet):', (e as Error).message);
  }
  fs.cpSync(SRC, DEST, { recursive: true });
  console.log('Messenger-Standalone kopiert nach:\n ', DEST);
  console.log('Dort: npm install, .env anlegen, npm start');
  console.log('Verkaufs-Bundle (sales): exports/Morgendrot-Messenger-verkauf/ manuell kopieren oder bundle:messenger:sales');
}

main();
