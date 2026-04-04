/**
 * Erzeugt MORG_LUMA_V1 + MORG_CHROMA_V1 aus einer Bilddatei (Phase-1-Pipeline).
 * Zum manuellen Test der Chat-UI über den Online-Pfad: Wire-Zeilen in zwei Nachrichten einfügen.
 *
 *   npx tsx scripts/print-lora-wires-for-ui-test.ts pfad/zum/bild.jpg
 *
 * Optional: zweites Argument = Ausgabeverzeichnis → schreibt luma-wire.txt und chroma-wire.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { prepareImageForLoRa } from '../src/lora-progressive-image.js';

async function main() {
    const imgPath = process.argv[2];
    const outDir = process.argv[3];
    if (!imgPath) {
        console.error('Verwendung: npx tsx scripts/print-lora-wires-for-ui-test.ts <bild.jpg> [ausgabe-ordner]');
        process.exit(1);
    }
    const buf = fs.readFileSync(imgPath);
    const r = await prepareImageForLoRa(buf);
    console.log('msgId:', r.messageId);
    console.log('Luma JPEG bytes:', r.lumaJpegBytes, '| Wire UTF-8 bytes:', r.lumaWireUtf8Bytes);
    console.log('Chroma JPEG bytes:', r.chromaJpegBytes, '| Wire UTF-8 bytes:', r.chromaWireUtf8Bytes);
    console.log('');
    if (outDir) {
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'luma-wire.txt'), r.lumaWire, 'utf8');
        fs.writeFileSync(path.join(outDir, 'chroma-wire.txt'), r.chromaWire, 'utf8');
        console.log('Geschrieben:', path.join(outDir, 'luma-wire.txt'));
        console.log('Geschrieben:', path.join(outDir, 'chroma-wire.txt'));
    } else {
        console.log('--- LUMA (komplette Zeile als eine Nachricht senden) ---');
        console.log(r.lumaWire);
        console.log('');
        console.log('--- CHROMA (zweite Nachricht, gleiche msgId) ---');
        console.log(r.chromaWire);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
