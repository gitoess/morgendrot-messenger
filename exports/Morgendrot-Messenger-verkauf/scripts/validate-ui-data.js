#!/usr/bin/env node
/**
 * Validiert UI-Datenstruktur (TREE, PROJECTS): Alle refs in Projekten müssen in TREE existieren.
 * Ausführung: node scripts/validate-ui-data.js
 * Liest ui/index.html und extrahiert TREE/PROJECTS per Regex (kein DOM).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'ui', 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.log('OK: Alte UI (ui/index.html) nicht vorhanden – neue UI (frontend) wird verwendet.');
  process.exit(0);
}
const html = fs.readFileSync(htmlPath, 'utf8');

// Namen aus TREE.items sammeln (name: 'X' oder name: "X")
const treeNames = new Set();
const treeItemRe = /name:\s*['"]([^'"]+)['"]/g;
let m;
while ((m = treeItemRe.exec(html)) !== null) {
  treeNames.add(m[1]);
}

// refs aus PROJECTS sammeln (ref: 'X' oder ref: "X")
const refs = new Set();
const refRe = /ref:\s*['"]([^'"]+)['"]/g;
while ((m = refRe.exec(html)) !== null) {
  refs.add(m[1]);
}

const missing = [];
for (const ref of refs) {
  if (ref === 'null' || ref === '') continue;
  if (!treeNames.has(ref)) missing.push(ref);
}

if (missing.length) {
  console.error('Fehler: Diese refs in PROJECTS fehlen in TREE:', missing);
  process.exit(1);
}

console.log('OK: Alle', refs.size, 'refs in PROJECTS existieren in TREE.');
process.exit(0);
