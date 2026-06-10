#!/usr/bin/env node
/**
 * Kopiert ausgewählte Markdown-Dateien aus docs/ nach frontend/public/handbook/
 * für PWA-Offline-Lesbarkeit (siehe docs/PWA-HANDBUCH-OFFLINE.md).
 * Ausführung: node scripts/sync-pwa-handbook.mjs  |  npm run sync:handbook
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const destDir = path.join(root, 'frontend', 'public', 'handbook');

const FILES = [
  'API-EINSATZ-ROLE-TEMPLATES.md',
  'BOSS-ORIENTIERUNG.md',
  'DASHBOARD-ERSTE-SCHRITTE.md',
  'DASHBOARD-PORT-UND-OBERFLAECHE.md',
  'GERAET-PROVISIONIEREN-WIZARD.md',
  'STANDALONE-HANDY-SCHNELLSTART.md',
  'PRODUCT-MESSENGER-VS-PROJEKT.md',
  'ONBOARDING-WALLET-UX-SPEC.md',
  'RECOVERY-PHRASE-BACKUP.md',
  'PWA-HANDBUCH-OFFLINE.md',
  'NOTFALL-PURGE-MESSENGER.md',
  'VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md',
  'EINSATZ-VAULT-PURGE-PDF-REDUNDANZ-ZIELBILD.md',
  'VAULT-TRAEGERBILD-EINSATZ-ORGANISATION.md',
  'ROLLENWECHSEL-TEAM-EINSATZ.md',
  'MESSENGER-CHAT-HANDBUCH.md',
  'WAS-IST-MORGENDROT-MESSENGER.md',
  'VAULT-EINRICHTEN.md',
  'VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md',
];

fs.mkdirSync(destDir, { recursive: true });
let n = 0;
for (const f of FILES) {
  const src = path.join(root, 'docs', f);
  if (!fs.existsSync(src)) {
    console.warn('sync-pwa-handbook: fehlt (überspringe):', src);
    continue;
  }
  fs.copyFileSync(src, path.join(destDir, f));
  n++;
}
console.log('sync-pwa-handbook:', n, 'Datei(en) →', destDir);
