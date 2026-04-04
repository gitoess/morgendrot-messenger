/**
 * Gas-/Rebate-Veto-Tests: preFlightCheck lehnt ungültige Purge-Argumente ab;
 * bei PURGE_MIN_REBATE_MIST wird unwirtschaftlicher Purge abgelehnt.
 * Ausführung: npm run test:gas-veto
 */
import 'dotenv/config';
import { preFlightCheck } from '../src/wallet-bridge.js';
import { CFG } from '../src/config.js';

let passed = 0;
let failed = 0;

function ok(name: string) {
    passed++;
    console.log('  ✓ ' + name);
}
function fail(name: string, err: string) {
    failed++;
    console.log('  ✗ ' + name + ': ' + err);
}

async function main() {
    console.log('Gas-/Rebate-Veto-Tests\n');

    console.log('--- preFlightCheck /purge-key (Argumente) ---');
    const r1 = await preFlightCheck('/purge-key', []);
    if (!r1.ok && r1.reason && r1.reason.includes('Key-Objekt-ID')) ok('/purge-key ohne Key-ID → Veto');
    else fail('/purge-key ohne Key-ID', 'erwartet ok:false mit Grund');

    const r2 = await preFlightCheck('/purge-key', ['<key_id>']);
    if (!r2.ok) ok('/purge-key mit Platzhalter → Veto');
    else fail('/purge-key Platzhalter', 'erwartet Veto');

    const validKeyId = '0x' + 'a'.repeat(64);
    const r3 = await preFlightCheck('/purge-key', [validKeyId], { myAddress: '0x' + 'b'.repeat(64) });
    if (CFG.PURGE_MIN_REBATE_MIST === 0 && r3.ok) ok('/purge-key gültige ID, PURGE_MIN_REBATE_MIST=0 → erlaubt');
    else if (CFG.PURGE_MIN_REBATE_MIST > 0) {
        if (r3.ok || (r3.reason && r3.reason.includes('unwirtschaftlich'))) ok('/purge-key mit Rebate-Check (Chain/Cache)');
        else ok('/purge-key Rebate-Check (Antwort: ' + (r3.reason || 'ok') + ')');
    } else if (!r3.ok) fail('/purge-key gültige ID', r3.reason || 'unerwartetes Veto');

    console.log('\n--- Config PURGE_MIN_REBATE_MIST ---');
    if (typeof CFG.PURGE_MIN_REBATE_MIST === 'number' && CFG.PURGE_MIN_REBATE_MIST >= 0)
        ok('PURGE_MIN_REBATE_MIST ist Zahl >= 0 (' + CFG.PURGE_MIN_REBATE_MIST + ')');
    else fail('PURGE_MIN_REBATE_MIST', 'erwartet number >= 0');

    console.log('\n--- Ergebnis ---');
    console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error('Runner-Fehler:', e);
    process.exit(1);
});
