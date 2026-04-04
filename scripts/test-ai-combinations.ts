/**
 * Test: Alle mathematisch/logisch denkbaren Kombinationen mit der KI.
 * - Direkte Befehle (tryDirectCommand)
 * - Intent-Matcher (tryIntentMatch) mit vielen Phrasen
 * - Optionen useIntentMatcher / useOllama (API-Verhalten)
 * Ollama wird nicht gestartet; nur Intent + Direkt werden durchgespielt.
 */
import { askAiCopilot } from '../src/ai-copilot.js';
import { tryIntentMatch } from '../src/ai-intent-matcher.js';

const ADDR = '0x' + 'a'.repeat(64);
const ADDR2 = '0x' + 'b'.repeat(64);

type TestCase = { input: string; expectCmd?: string; expectArgsLength?: number; description?: string };

const INTENT_TEST_CASES: TestCase[] = [
    { input: 'verbinde mit ' + ADDR, expectCmd: '/connect', expectArgsLength: 1, description: 'Connect mit Adresse' },
    { input: 'sende hallo', expectCmd: '/send', expectArgsLength: 1 },
    { input: 'schick nachricht', expectCmd: '/send' },
    { input: 'hole letzten 20', expectCmd: '/fetch', expectArgsLength: 1 },
    { input: 'fetch 50', expectCmd: '/fetch' },
    { input: 'handshake an ' + ADDR, expectCmd: '/handshake', expectArgsLength: 1 },
    { input: 'setze package ' + ADDR, expectCmd: '/set-package-id', expectArgsLength: 1 },
    { input: 'vault speichern', expectCmd: '/vault-save', expectArgsLength: 0 },
    { input: 'liste keys', expectCmd: '/list-keys', expectArgsLength: 0 },
    { input: 'purge handshake', expectCmd: '/purge-handshake', expectArgsLength: 0 },
    { input: 'vault onchain', expectCmd: '/vault-onchain', expectArgsLength: 0 },
    { input: 'emergency purge', expectCmd: '/emergency-purge', expectArgsLength: 0 },
    { input: 'liste tickets', expectCmd: '/list-tickets', expectArgsLength: 0 },
    {
        input: `sende verschlüsselt halloduda an ${ADDR}`,
        expectCmd: '/handshake',
        expectArgsLength: 1,
        description: 'Send encrypted → Sender: /handshake, Partner danach /connect',
    },
    {
        input: 'erstelle key ' + ADDR + ' ' + ADDR2 + ' 7',
        expectCmd: '/create-key',
        expectArgsLength: 3,
        description: 'create-key zwei Adressen + ttl',
    },
    {
        input: 'Erstelle ein Ticket für hexefest und sende an Adresse 0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5',
        expectCmd: '/create-ticket',
        expectArgsLength: 5,
        description: 'Ticket für Event an Adresse',
    },
    {
        input: 'erstelle ein ticket "baum" und sende es an 0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5',
        expectCmd: '/create-ticket',
        expectArgsLength: 5,
        description: 'Ticket "baum" sende es an 0x (kein Handshake)',
    },
    { input: 'sende 1 iota an ' + ADDR, expectCmd: '/transfer-coins', expectArgsLength: 2 },
    { input: 'schick klartext hallo an ' + ADDR, expectCmd: '/send-plain', expectArgsLength: 2 },
    { input: 'erstelle 3 keys für ' + ADDR + ' mit 14 tagen', expectCmd: '/create-keys', expectArgsLength: 4 },
    { input: 'gast ' + ADDR + ' soll key bekommen und bestätigung', expectCmd: '/create-key-and-notify', expectArgsLength: 4 },
    { input: 'lösche den alten key mit der id 0x' + '1'.repeat(64), expectCmd: '/purge-key', expectArgsLength: 1 },
    { input: 'ticket 0x' + '2'.repeat(64) + ' löschen', expectCmd: '/purge-ticket', expectArgsLength: 1 },
    { input: 'hole letzten 50 von ' + ADDR, expectCmd: '/fetch', expectArgsLength: 2 },
    { input: 'key ' + ADDR + ' für notfall-purge', expectCmd: '/emergency-purge-key', expectArgsLength: 1 },
    { input: 'nachricht aus mailbox löschen nonce 42', expectCmd: '/purge-msg', expectArgsLength: 1 },
];

const DIRECT_COMMAND_CASES: TestCase[] = [
    { input: '/connect ' + ADDR, expectCmd: '/connect', expectArgsLength: 1 },
    { input: '/send hallo welt', expectCmd: '/send', expectArgsLength: 2 },
    { input: '/fetch 30', expectCmd: '/fetch', expectArgsLength: 1 },
    { input: '/handshake ' + ADDR, expectCmd: '/handshake', expectArgsLength: 1 },
    { input: '/set-package-id ' + ADDR, expectCmd: '/set-package-id', expectArgsLength: 1 },
    { input: '/vault-save', expectCmd: '/vault-save', expectArgsLength: 0 },
    { input: '/list-keys', expectCmd: '/list-keys', expectArgsLength: 0 },
    { input: '/purge-handshake', expectCmd: '/purge-handshake', expectArgsLength: 0 },
    { input: '/create-key ' + ADDR + ' ' + ADDR2 + ' 1', expectCmd: '/create-key', expectArgsLength: 3 },
];

async function runTests() {
    let passed = 0;
    let failed = 0;

    console.log('=== 1) Direkte Befehle (tryDirectCommand) ===');
    for (const tc of DIRECT_COMMAND_CASES) {
        const r = await askAiCopilot(tc.input, undefined, { useIntentMatcher: false, useOllama: false });
        const cmd = r.suggestedAction?.cmd;
        const argsLen = r.suggestedAction?.args?.length ?? 0;
        const ok = r.ok && cmd === tc.expectCmd && (tc.expectArgsLength === undefined || argsLen === tc.expectArgsLength);
        if (ok) {
            passed++;
            console.log('  OK:', tc.input.slice(0, 50) + (tc.input.length > 50 ? '…' : ''));
        } else {
            failed++;
            console.log('  FAIL:', tc.input, '→ got', cmd, 'args', argsLen, 'expected', tc.expectCmd, tc.expectArgsLength);
        }
    }

    console.log('\n=== 2) Intent-Matcher (tryIntentMatch) ===');
    for (const tc of INTENT_TEST_CASES) {
        const result = tryIntentMatch(tc.input);
        const cmd = result?.suggestedAction?.cmd;
        const argsLen = result?.suggestedAction?.args?.length ?? 0;
        const ok =
            result?.ok &&
            cmd === tc.expectCmd &&
            (tc.expectArgsLength === undefined || argsLen === tc.expectArgsLength);
        if (ok) {
            passed++;
            console.log('  OK:', (tc.description || tc.input).slice(0, 60));
        } else {
            failed++;
            console.log('  FAIL:', tc.description || tc.input.slice(0, 40), '→ got', cmd, 'args', argsLen);
        }
    }

    console.log('\n=== 3) askAiCopilot mit Optionen (useIntentMatcher only, no Ollama) ===');
    const intentEnabled = process.env.ENABLE_AI_INTENT_MATCHER === 'true';
    if (!intentEnabled) {
        console.log('  (Übersprungen: ENABLE_AI_INTENT_MATCHER nicht true. Setze z. B. $env:ENABLE_AI_INTENT_MATCHER="true")');
    } else {
        for (const tc of INTENT_TEST_CASES.slice(0, 5)) {
            const r = await askAiCopilot(tc.input, undefined, { useIntentMatcher: true, useOllama: false });
            const cmd = r.suggestedAction?.cmd;
            const ok = r.ok && (!tc.expectCmd || cmd === tc.expectCmd);
            if (ok) {
                passed++;
                console.log('  OK:', tc.input.slice(0, 45));
            } else {
                failed++;
                console.log('  FAIL:', tc.input.slice(0, 40), '→', r.ok ? cmd : r.error);
            }
        }
    }

    console.log('\n=== 4) Kombination: beide aus → Fehler erwartet ===');
    const r = await askAiCopilot('sende hallo', undefined, { useIntentMatcher: false, useOllama: false });
    const errExpected = !r.ok && r.error && r.error.includes('Kein Treffer');
    if (errExpected) {
        passed++;
        console.log('  OK: Beide aus → Fehlermeldung wie erwartet');
    } else {
        failed++;
        console.log('  FAIL: Erwartet Fehler, got', r.ok ? r.suggestedAction : r.error);
    }

    console.log('\n--- Ergebnis ---');
    console.log('Bestanden:', passed, 'Fehlgeschlagen:', failed);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
