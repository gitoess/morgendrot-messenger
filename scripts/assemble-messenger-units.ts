/**
 * Legt pro Einheit in exports/messenger-shipments/<runId>/uNNN/ eine **kopie** des Messenger-Bundles an
 * und überschreibt .env + config.json aus der Einheit.
 *
 * Voraussetzung: npm run bundle:messenger (oder :sales) – Ziel-Bundle muss existieren.
 *
 * Usage:
 *   npx tsx scripts/assemble-messenger-units.ts <runId> [sales|standalone]
 *
 * Ausgabe: exports/messenger-shipments/<runId>/assembled/uNNN/ (vollständiger Ordner)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

function rmrf(p: string) {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

function main() {
    const runId = process.argv[2];
    const edition = (process.argv[3] || 'sales').toLowerCase() === 'standalone' ? 'standalone' : 'sales';
    if (!runId || !String(runId).trim()) {
        console.error('Usage: npx tsx scripts/assemble-messenger-units.ts <runId> [sales|standalone]');
        process.exit(1);
    }
    const safeRun = String(runId).replace(/[^a-zA-Z0-9._-]/g, '_');
    const shipDir = path.join(REPO, 'exports', 'messenger-shipments', safeRun);
    if (!fs.existsSync(shipDir)) {
        console.error('Shipment fehlt:', shipDir);
        process.exit(1);
    }
    const bundleName = edition === 'sales' ? 'Morgendrot-Messenger-verkauf' : 'Morgendrot-Messenger-standalone';
    const bundleRoot = path.join(REPO, 'exports', bundleName);
    const marker = path.join(bundleRoot, 'src', 'start-with-secrets.ts');
    if (!fs.existsSync(marker)) {
        console.error('Bundle ohne Code. Zuerst: npm run bundle:messenger');
        process.exit(1);
    }

    const outRoot = path.join(shipDir, 'assembled');
    fs.mkdirSync(outRoot, { recursive: true });

    const entries = fs.readdirSync(shipDir, { withFileTypes: true });
    let n = 0;
    for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const name = ent.name;
        if (name === 'boss-only' || name === 'assembled') continue;
        if (!/^u\d{3}$/.test(name)) continue;
        const unitDir = path.join(shipDir, name);
        const envPath = path.join(unitDir, '.env');
        const cfgPath = path.join(unitDir, 'config.json');
        if (!fs.existsSync(envPath)) continue;

        const dest = path.join(outRoot, name);
        rmrf(dest);
        fs.cpSync(bundleRoot, dest, { recursive: true });
        fs.copyFileSync(envPath, path.join(dest, '.env'));
        if (fs.existsSync(cfgPath)) fs.copyFileSync(cfgPath, path.join(dest, 'config.json'));

        const bossOnlySrc = path.join(unitDir, 'LIESMICH-KUNDE.txt');
        if (fs.existsSync(bossOnlySrc)) {
            fs.copyFileSync(bossOnlySrc, path.join(dest, 'LIESMICH-KUNDE.txt'));
        }
        n++;
        console.log('OK', path.relative(REPO, dest));
    }
    console.log('Fertig:', n, 'Ordner unter', path.relative(REPO, outRoot));
}

main();
