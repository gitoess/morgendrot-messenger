#!/usr/bin/env node
/**
 * Löscht regenerierbare Build-/Test-Caches (Windows + Unix).
 * Berührt nicht: .env, Vault, node_modules (außer --deep).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const deep = process.argv.includes('--deep');

const dirs = [
  'frontend/.next',
  '.next',
  'frontend/.turbo',
  '.turbo',
  'tmp',
  'logs',
  'test-results',
  'test-screenshots',
  'coverage',
  'frontend/node_modules/.cache',
  /** Electron-Launcher — nur bei Bedarf: cd morgendrot-messenger-desktop && npm install */
  'morgendrot-messenger-desktop/node_modules',
];

const rootFiles = [
  '.streams-mock-data.json',
  'rustup-init.exe',
  'explorer-chain-1000-links.txt',
  'explorer-chain-1000-result.json',
  'firma-explorer-links.txt',
  'firma-realworld-result.json',
  'realworld-echte-tx-result.json',
  'all-tiles-combinations-result.json',
  'tiles-combinations-links.txt',
];

if (deep) {
  dirs.push('frontend/node_modules', 'node_modules', 'morgendrot-messenger-desktop/node_modules');
}

function dirSizeBytes(p) {
  if (!fs.existsSync(p)) return 0;
  const st = fs.statSync(p);
  if (st.isFile()) return st.size;
  let sum = 0;
  for (const ent of fs.readdirSync(p, { withFileTypes: true })) {
    const child = path.join(p, ent.name);
    try {
      sum += ent.isDirectory() ? dirSizeBytes(child) : fs.statSync(child).size;
    } catch {
      /* skip locked */
    }
  }
  return sum;
}

function rm(target) {
  const abs = path.isAbsolute(target) ? target : path.join(root, target);
  if (!fs.existsSync(abs)) return null;
  const before = dirSizeBytes(abs);
  fs.rmSync(abs, { recursive: true, force: true });
  return before;
}

let freed = 0;
const removed = [];

for (const d of dirs) {
  const n = rm(d);
  if (n != null) {
    freed += n;
    removed.push(d);
  }
}

for (const f of rootFiles) {
  const n = rm(f);
  if (n != null) {
    freed += n;
    removed.push(f);
  }
}

const mb = (freed / (1024 * 1024)).toFixed(0);
const gb = (freed / (1024 * 1024 * 1024)).toFixed(2);
console.log(
  removed.length
    ? `clean: ${removed.length} Pfad(e) entfernt (~${mb} MB / ${gb} GB frei).`
    : 'clean: nichts zu löschen (Caches bereits leer).'
);
if (removed.length) console.log('  ' + removed.join('\n  '));
if (deep) {
  console.log('deep: node_modules entfernt — im Root und frontend/ jeweils npm install ausführen.');
} else {
  console.log('Hinweis: npm run dev baut frontend/.next neu (erster Start dauert länger).');
  console.log('Optional: npm run clean:deep für node_modules (danach npm install).');
}
