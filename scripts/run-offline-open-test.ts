/**
 * Offline-Open-Tests: Config OFFLINE_OPEN_ENABLED + Cache-Logik.
 * Beweist, dass Offline-Modus (Cache) konfigurierbar ist und Cache-Hit-Logik funktioniert.
 * Ausführung: OFFLINE_OPEN_ENABLED=true npm run test:offline-open  (oder in .env)
 */
import 'dotenv/config';
import {
    setOfflineCacheForTest,
    getOfflineCacheSizeForTest,
    isOfflineCacheHitForTest,
} from '../src/m2m-lock.js';
import { CFG } from '../src/config.js';

let passed = 0;
let failed = 0;

function ok(name: string) {
    passed++;
    console.log('  ✓ ' + name);
}
function fail(name: string, err: unknown) {
    failed++;
    console.log('  ✗ ' + name + ': ' + (err instanceof Error ? err.message : String(err)));
}

const addr64 = '0x' + 'a'.repeat(64);

async function main() {
    console.log('Offline-Open-Tests (OFFLINE_OPEN_ENABLED + Cache)\n');

    console.log('--- Config ---');
    if (CFG.OFFLINE_OPEN_ENABLED === true) ok('OFFLINE_OPEN_ENABLED wird aus Env gelesen');
    else console.log('  ⚠ OFFLINE_OPEN_ENABLED nicht true (optional: in .env oder OFFLINE_OPEN_ENABLED=true)');

    const ttl = CFG.OFFLINE_CACHE_TTL_MS;
    if (typeof ttl === 'number' && ttl > 0) ok('OFFLINE_CACHE_TTL_MS gesetzt (' + ttl + ' ms)');
    else fail('OFFLINE_CACHE_TTL_MS', new Error('erwartet positive Zahl'));

    console.log('\n--- Offline-Cache (Test-Helfer) ---');
    setOfflineCacheForTest(addr64, Date.now() + 60_000);
    if (getOfflineCacheSizeForTest() >= 1) ok('Cache nach setOfflineCacheForTest befüllt');
    else fail('Cache-Größe', new Error('erwartet >= 1'));

    if (isOfflineCacheHitForTest(addr64)) ok('isOfflineCacheHitForTest: Hit bei gültigem Eintrag');
    else fail('Cache-Hit', new Error('erwartet true'));

    setOfflineCacheForTest(addr64, Date.now() - 1000);
    if (!isOfflineCacheHitForTest(addr64)) ok('isOfflineCacheHitForTest: Kein Hit bei abgelaufenem Eintrag');
    else fail('Cache abgelaufen', new Error('erwartet false'));

    const otherAddr = '0x' + 'b'.repeat(64);
    setOfflineCacheForTest(addr64, Date.now() + 60_000);
    if (!isOfflineCacheHitForTest(otherAddr)) ok('isOfflineCacheHitForTest: Kein Hit für anderen Sender');
    else fail('Cache anderer Sender', new Error('erwartet false'));

    console.log('\n--- Ergebnis ---');
    console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error('Runner-Fehler:', e);
    process.exit(1);
});
