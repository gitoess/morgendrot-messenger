/**
 * Erzeugt PNG-Icons aus frontend/public/icon.svg für PWA/Manifest und layout.tsx.
 * Ausführen: npm run build:pwa-icons (Root). Benötigt: sharp (devDependency).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(__dirname, '../frontend/public');
const svgPath = path.join(pub, 'icon.svg');

async function main() {
    if (!fs.existsSync(svgPath)) {
        console.error('Fehlt:', svgPath);
        process.exit(1);
    }
    const sizes = [
        ['icon-192.png', 192],
        ['icon-512.png', 512],
        ['apple-icon.png', 180],
    ];
    for (const [name, size] of sizes) {
        const out = path.join(pub, name);
        await sharp(svgPath).resize(size, size).png().toFile(out);
        console.log('OK', name);
    }
    const small = 32;
    const smallBuf = await sharp(svgPath).resize(small, small).png().toBuffer();
    fs.writeFileSync(path.join(pub, 'icon-light-32x32.png'), smallBuf);
    fs.writeFileSync(path.join(pub, 'icon-dark-32x32.png'), smallBuf);
    console.log('OK icon-light-32x32.png, icon-dark-32x32.png (identisch, SVG-Rendering)');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
