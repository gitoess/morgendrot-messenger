/**
 * Legt `.env` aus `.env.example` an, falls `.env` fehlt (z. B. frischer Clone).
 * Installiert Abhängigkeiten lokaler file:-Pakete (`@morgendrot/core`), damit Next/Webpack
 * `@iota/iota-sdk` etc. unter `packages/morgendrot-core/node_modules` auflösen kann.
 * Läuft bei `npm install` — bestehende `.env` wird nicht überschrieben.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');
const coreDir = path.join(root, 'packages', 'morgendrot-core');

function installCoreDeps() {
  const pkgPath = path.join(coreDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const nodeModules = path.join(coreDir, 'node_modules', '@iota', 'iota-sdk');
  if (fs.existsSync(nodeModules)) return;
  console.log('[ensure-env] @morgendrot/core: npm install (fehlende node_modules)…');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npmCmd, ['install', '--no-audit', '--no-fund'], {
    cwd: coreDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    console.warn('[ensure-env] npm install in packages/morgendrot-core fehlgeschlagen — bitte manuell ausführen.');
  }
}

installCoreDeps();

if (fs.existsSync(envPath)) {
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.warn('[ensure-env] .env.example fehlt — überspringe.');
  process.exit(0);
}

fs.copyFileSync(examplePath, envPath);
console.log('[ensure-env] .env aus .env.example erstellt (bitte Werte anpassen).');
