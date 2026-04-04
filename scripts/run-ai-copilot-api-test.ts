/**
 * Integration-Test für AI-Copilot: gleicher Vertrag wie POST /api/ai-copilot.
 * Ruft askAiCopilot direkt auf (ohne HTTP). Prüft: Antwort-Struktur, Intent-Treffer, ACTION-Zeile.
 * Ausführung: npx tsx scripts/run-ai-copilot-api-test.ts
 */
import { strict as assert } from 'node:assert';
import { askAiCopilot } from '../src/ai-copilot.js';

const ADDR = '0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5';

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

async function run() {
    console.log('Morgendrot – AI-Copilot Integration (API-Vertrag)\n');

    // 1) Transfer-Coins: Intent soll /transfer-coins liefern
    console.log('--- Intent: /transfer-coins ---');
    try {
        const r = await askAiCopilot(
            'sende 1 iota an ' + ADDR,
            { myAddressSet: true, packageIdSet: true, connected: false },
            { useIntentMatcher: true, useOllama: false },
        );
        assert.strictEqual(r.ok, true, 'ok true');
        assert.ok(r.suggestedAction?.cmd === '/transfer-coins', 'cmd = /transfer-coins, got: ' + r.suggestedAction?.cmd);
        assert.ok(Array.isArray(r.suggestedAction?.args) && r.suggestedAction!.args.length >= 2, 'args mit Adresse und Betrag');
        ok('Transfer-Coins Intent');
    } catch (e) {
        fail('Transfer-Coins Intent', e);
    }

    // 2) Handshake: Intent soll /handshake liefern
    console.log('--- Intent: /handshake ---');
    try {
        const r = await askAiCopilot(
            'handshake an ' + ADDR,
            { myAddressSet: true, packageIdSet: true, connected: false },
            { useIntentMatcher: true, useOllama: false },
        );
        assert.strictEqual(r.ok, true);
        assert.strictEqual(r.suggestedAction?.cmd, '/handshake');
        assert.ok((r.suggestedAction?.args?.length ?? 0) >= 1, 'Adresse in args');
        ok('Handshake Intent');
    } catch (e) {
        fail('Handshake Intent', e);
    }

    // 3) Hilfefrage: Text-Antwort, keine ACTION nötig
    console.log('--- Hilfefrage (Text) ---');
    try {
        const r = await askAiCopilot(
            'was sind die 13 schritte',
            undefined,
            { useIntentMatcher: true, useOllama: false },
        );
        assert.strictEqual(r.ok, true);
        assert.ok(typeof r.text === 'string' && r.text.length > 20, 'Text-Antwort nicht leer');
        ok('Hilfefrage Text');
    } catch (e) {
        fail('Hilfefrage Text', e);
    }

    // 4) Leere Nachricht / ungültig: ok false oder sinnvolle Reaktion
    console.log('--- Leere Nachricht ---');
    try {
        const r = await askAiCopilot('', undefined, { useIntentMatcher: true, useOllama: false });
        assert.ok(typeof r.ok === 'boolean');
        assert.ok(r.ok === false || (r.text && r.text.length >= 0));
        ok('Leere Nachricht');
    } catch (e) {
        fail('Leere Nachricht', e);
    }

    // 5) create-key: Intent soll /create-key liefern
    console.log('--- Intent: /create-key ---');
    try {
        const r = await askAiCopilot(
            'lass gast ' + ADDR + ' rein',
            { myAddressSet: true, packageIdSet: true },
            { useIntentMatcher: true, useOllama: false },
        );
        assert.strictEqual(r.ok, true);
        assert.strictEqual(r.suggestedAction?.cmd, '/create-key');
        ok('Create-Key Intent');
    } catch (e) {
        fail('Create-Key Intent', e);
    }

    console.log('\n--- Ergebnis ---');
    console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
    console.error('Runner-Fehler:', e);
    process.exit(1);
});
