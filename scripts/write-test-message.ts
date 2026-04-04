/**
 * Schreibt eine unverschlüsselte Testnachricht in eine Datei (lokal, ohne Chain).
 * Nützlich um zu prüfen, dass "Nachricht schreiben" und Ausgabe funktionieren.
 *
 * Aufruf:
 *   npx tsx scripts/write-test-message.ts
 *   npx tsx scripts/write-test-message.ts "Hallo, das ist ein Test"
 *   npm run test:message
 *   npm run test:message -- "Meine Nachricht"
 *
 * Ausgabe: Datei test-message.txt (oder Pfad aus TEST_MESSAGE_FILE) mit Timestamp + Inhalt.
 */
import fs from 'fs';
import path from 'path';

const outFile = process.env.TEST_MESSAGE_FILE || path.resolve(process.cwd(), 'test-message.txt');
const message = process.argv[2] ?? 'Unverschlüsselte Testnachricht (lokal)';
const line = `[${new Date().toISOString()}] ${message}\n`;

fs.appendFileSync(outFile, line, 'utf-8');
console.log('Nachricht geschrieben nach:', outFile);
console.log('Inhalt:', line.trim());
