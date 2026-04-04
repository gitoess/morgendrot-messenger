/**
 * Generiert ui/doc-contents.js aus docs/*.md
 * Läuft mit: npx tsx scripts/build-doc-contents.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, '..', 'docs');
const OUT_FILE = path.resolve(__dirname, '..', 'docs', 'generated-doc-contents.js');

const DOC_NAMES = [
  'CHAT-GRUPPE-EINRICHTEN.md',
  'M2M-KOORDINATION-EINRICHTEN.md',
  'SENSOR-ALARME-EINRICHTEN.md',
  'SCHLOSS-EINRICHTEN.md',
  'BROADCAST-PINNWAND.md',
  'VAULT-EINRICHTEN.md',
  'CAR-SHARING-EINRICHTEN.md',
  'BOSS-MODUS.md',
  'LEIHGERAETE-EINRICHTEN.md',
  'FAMILIEN-ZUGANG.md',
  'NOTFALL-DATENSPEICHER.md',
  'ENV-ERKLAERUNG.md',
  'STREAMS-INTEGRATION.md',
  'FESTIVAL-TICKETS-EINRICHTEN.md',
  'OFFLINE-FAEHIGKEIT.md',
  'PACKAGE-ID-NEU-DEPLOYEN.md',
  'CHAT-DURCHTESTEN.md',
];

function escapeForTemplateLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

const entries: string[] = [];
for (const name of DOC_NAMES) {
  const filePath = path.join(DOCS_DIR, name);
  if (!fs.existsSync(filePath)) {
    console.warn('Fehlt:', name);
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const escaped = escapeForTemplateLiteral(content);
  entries.push(`    '${name}': \`${escaped}\``);
}

const js = `/**
 * Eingebettete Anleitungen – keine Server-Anfrage nötig.
 * Generiert von: npx tsx scripts/build-doc-contents.ts
 */
(function(global) {
  const docs = {
${entries.join(',\n')}
  };
  global.DOC_CONTENTS = docs;
})(typeof window !== 'undefined' ? window : this);
`;

fs.writeFileSync(OUT_FILE, js, 'utf-8');
console.log('doc-contents.js erstellt mit', entries.length, 'Anleitungen');
