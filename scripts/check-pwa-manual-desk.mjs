/**
 * Schreibtisch-Vorprüfung aus docs/PWA-MANUAL-CHECKS.md (§ H.2): A + B; optional C (--full).
 * A: npm run build:pwa-icons  B: npm run sync:handbook  C: cd frontend && npm run build
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const frontend = path.join(root, 'frontend');

function runNpmRun(cwd, script) {
    try {
        execSync(`npm run ${script}`, { cwd, stdio: 'inherit', env: process.env });
    } catch {
        process.exit(1);
    }
}

const full = process.argv.includes('--full');

console.log('[check-pwa-manual-desk] A — build:pwa-icons …');
runNpmRun(root, 'build:pwa-icons');
console.log('[check-pwa-manual-desk] B — sync:handbook …');
runNpmRun(root, 'sync:handbook');

if (full) {
    console.log('[check-pwa-manual-desk] C — frontend build (next build, inkl. prebuild) …');
    runNpmRun(frontend, 'build');
} else {
    console.log('[check-pwa-manual-desk] C — übersprungen. Vollständig: npm run check:pwa-desk:full');
}

console.log('[check-pwa-manual-desk] OK.');
