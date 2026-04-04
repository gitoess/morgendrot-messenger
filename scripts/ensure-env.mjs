/**
 * Legt `.env` aus `.env.example` an, falls `.env` fehlt (z. B. frischer Clone).
 * Läuft bei `npm install` — bestehende `.env` wird nicht überschrieben.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

if (fs.existsSync(envPath)) {
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.warn('[ensure-env] .env.example fehlt — überspringe.');
  process.exit(0);
}

fs.copyFileSync(examplePath, envPath);
console.log('[ensure-env] .env aus .env.example erstellt (bitte Werte anpassen).');
