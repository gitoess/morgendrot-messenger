#!/usr/bin/env node
/**
 * Kopiert package-profiles.manifest.json ins Lite-UI (ui/) und optional ins PWA-public.
 * Quelle: frontend/public/templates/package-profiles.manifest.json
 * Ausführung: npm run sync:package-profiles
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'frontend', 'public', 'templates', 'package-profiles.manifest.json');

if (!fs.existsSync(src)) {
  console.error('sync-package-profiles: fehlt', src);
  process.exit(1);
}

const text = fs.readFileSync(src, 'utf8');
JSON.parse(text);

const destinations = [
  path.join(root, 'ui', 'package-profiles.manifest.json'),
  path.join(root, 'frontend', 'public', 'package-profiles.manifest.json'),
];

for (const dest of destinations) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text.endsWith('\n') ? text : text + '\n', 'utf8');
  console.log('sync-package-profiles:', path.relative(root, dest));
}
