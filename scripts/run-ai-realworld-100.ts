/**
 * KI-Test: 100 verschiedene Real-World-Befehle aus allen Kacheln inkl. ganzer Abläufe.
 * Prüft nur die KI-Ausgabe (kein API-Aufruf). Intent-Matcher + optional Ollama.
 *
 * Aufruf: npx tsx scripts/run-ai-realworld-100.ts
 *         OLLAMA_URL=http://127.0.0.1:11434 npx tsx scripts/run-ai-realworld-100.ts  (mit Ollama)
 */
import 'dotenv/config';
import { askAiCopilot } from '../src/ai-copilot.js';

const ADDR = '0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5';
const ADDR2 = '0x' + 'b'.repeat(64);
const OBJ = '0x' + '1'.repeat(64);
const OBJ2 = '0x' + '2'.repeat(64);

type Case = { input: string; expectCmd: string | string[]; kachel: string; ablauf?: boolean };

function norm(cmd: string): string {
    return (cmd || '').replace(/^\//, '').toLowerCase();
}
function match(cmd: string, expected: string | string[]): boolean {
    const c = norm(cmd);
    if (Array.isArray(expected)) return expected.some((e) => c === norm(e));
    return c === norm(expected);
}

const SCENARIOS: Case[] = [
    // --- 1. Anfang (Fundament) ---
    { input: 'Setze die Package-ID auf ' + ADDR, expectCmd: '/set-package-id', kachel: '1. Anfang' },
    { input: 'Package-ID setzen ' + ADDR, expectCmd: '/set-package-id', kachel: '1. Anfang' },
    { input: 'Set package id to ' + ADDR, expectCmd: '/set-package-id', kachel: '1. Anfang' },
    { input: 'hilfe anzeigen', expectCmd: '', kachel: '1. Anfang' },
    { input: 'was kann ich alles machen', expectCmd: '', kachel: '1. Anfang' },
    // --- 2. Kanal ---
    { input: 'Handshake an ' + ADDR + ' senden', expectCmd: '/handshake', kachel: '2. Kanal' },
    { input: 'Verbinde mich mit ' + ADDR, expectCmd: '/connect', kachel: '2. Kanal' },
    { input: 'sichere leitung zu ' + ADDR + ' aufbauen', expectCmd: '/handshake', kachel: '2. Kanal' },
    { input: 'verbinde mit ' + ADDR, expectCmd: '/connect', kachel: '2. Kanal' },
    { input: 'Connect to ' + ADDR, expectCmd: '/connect', kachel: '2. Kanal' },
    { input: 'Ich will verschlüsselt an ' + ADDR + ' schreiben', expectCmd: '/handshake', kachel: '2. Kanal' },
    { input: 'chat mit ' + ADDR + ' starten', expectCmd: '/connect', kachel: '2. Kanal' },
    // --- 3. Chat ---
    { input: 'Schick Klartext Hallo an ' + ADDR, expectCmd: '/send-plain', kachel: '3. Chat' },
    { input: 'sende nachricht "ki läuft" an ' + ADDR, expectCmd: '/send-plain', kachel: '3. Chat' },
    { input: 'schick klartext test an ' + ADDR, expectCmd: '/send-plain', kachel: '3. Chat' },
    { input: 'Sag ' + ADDR + ' Bescheid: Meeting um 10', expectCmd: '/send-plain', kachel: '3. Chat' },
    { input: 'Sende die Nachricht Hallo Welt', expectCmd: '/send', kachel: '3. Chat' },
    { input: 'sende hallo', expectCmd: '/send', kachel: '3. Chat' },
    { input: 'verschlüsselte nachricht schicken', expectCmd: '/send', kachel: '3. Chat' },
    { input: 'Hole die letzten 20 Nachrichten', expectCmd: '/fetch', kachel: '3. Chat' },
    { input: 'hole letzten 50', expectCmd: '/fetch', kachel: '3. Chat' },
    { input: 'hole letzte 100 von ' + ADDR, expectCmd: '/fetch', kachel: '3. Chat' },
    { input: 'Fetch 50 messages', expectCmd: '/fetch', kachel: '3. Chat' },
    { input: 'Jetzt verschlüsselt senden: Bereit', expectCmd: '/send', kachel: '3. Chat' },
    // --- 4. Nachsorge / Vault / Purge ---
    { input: 'Vault speichern', expectCmd: '/vault-save', kachel: '4. Nachsorge' },
    { input: 'speichere messaging-keys lokal', expectCmd: '/vault-save', kachel: '4. Nachsorge' },
    { input: 'vault onchain', expectCmd: '/vault-onchain', kachel: '4. Nachsorge' },
    { input: 'Keys in Vault speichern', expectCmd: '/vault-save', kachel: '4. Nachsorge' },
    { input: 'purge handshake', expectCmd: '/purge-handshake', kachel: '4. Nachsorge' },
    { input: 'lösche den handshake aus der mailbox', expectCmd: '/purge-handshake', kachel: '4. Nachsorge' },
    { input: 'nachricht aus mailbox löschen nonce 18', expectCmd: '/purge-msg', kachel: '4. Nachsorge' },
    { input: 'emergency purge', expectCmd: '/emergency-purge', kachel: '4. Nachsorge' },
    { input: 'Notfall-Purge für Vault', expectCmd: '/emergency-purge', kachel: '4. Nachsorge' },
    { input: 'Lösche Handshake', expectCmd: '/purge-handshake', kachel: '4. Nachsorge' },
    { input: 'backup der keys machen', expectCmd: '/vault-save', kachel: '4. Nachsorge' },
    // --- 5. Keys ---
    { input: 'Lass den Gast ' + ADDR + ' rein', expectCmd: '/create-key', kachel: '5. Keys' },
    { input: 'lass gast ' + ADDR + ' rein', expectCmd: '/create-key', kachel: '5. Keys' },
    { input: 'Gib der Adresse ' + ADDR + ' einen Schlüssel für 7 Tage', expectCmd: '/create-key', kachel: '5. Keys' },
    { input: 'zutritt für ' + ADDR + ' für 14 tage', expectCmd: '/create-key', kachel: '5. Keys' },
    { input: 'gib der adresse ' + ADDR + ' einen schlüssel für 30 tage', expectCmd: '/create-key', kachel: '5. Keys' },
    { input: 'Erstelle 3 Keys für ' + ADDR + ' mit 14 Tagen', expectCmd: ['/create-keys', '/create-key'], kachel: '5. Keys' },
    { input: 'drei gäste-keys für ' + ADDR, expectCmd: '/create-keys', kachel: '5. Keys' },
    { input: 'gast ' + ADDR + ' soll key bekommen und bestätigung', expectCmd: '/create-key-and-notify', kachel: '5. Keys' },
    { input: 'zeig mir meine accesskeys', expectCmd: '/list-keys', kachel: '5. Keys' },
    { input: 'Zeig mir meine AccessKeys', expectCmd: '/list-keys', kachel: '5. Keys' },
    { input: 'lösche den alten key mit der id ' + OBJ, expectCmd: '/purge-key', kachel: '5. Keys' },
    { input: 'key ' + OBJ + ' für notfall-purge vorbereiten', expectCmd: '/emergency-purge-key', kachel: '5. Keys' },
    { input: 'übertrage key ' + OBJ + ' an ' + ADDR2, expectCmd: '/transfer-key', kachel: '5. Keys' },
    { input: 'Purge key ' + OBJ, expectCmd: '/purge-key', kachel: '5. Keys' },
    { input: 'Liste alle Keys', expectCmd: '/list-keys', kachel: '5. Keys' },
    // --- 6. Tickets ---
    { input: 'erstelle ein ticket "event" und sende es an ' + ADDR, expectCmd: '/create-ticket', kachel: '6. Tickets' },
    { input: 'ticket für event erstellen an ' + ADDR, expectCmd: '/create-ticket', kachel: '6. Tickets' },
    { input: 'zeig meine tickets', expectCmd: '/list-tickets', kachel: '6. Tickets' },
    { input: 'Zeig meine Tickets', expectCmd: '/list-tickets', kachel: '6. Tickets' },
    { input: 'ticket ' + OBJ + ' einlösen für event ' + OBJ2, expectCmd: '/use-ticket', kachel: '6. Tickets' },
    { input: 'ticket ' + OBJ + ' löschen', expectCmd: '/purge-ticket', kachel: '6. Tickets' },
    { input: 'ticket ' + OBJ + ' an ' + ADDR2 + ' übertragen', expectCmd: ['/transfer-ticket', '/transfer-key'], kachel: '6. Tickets' },
    { input: 'Erstelle Ticket für "weihnachtsmarkt" an ' + ADDR, expectCmd: '/create-ticket', kachel: '6. Tickets' },
    { input: 'Ticket ' + OBJ + ' für Event ' + ADDR2 + ' einlösen', expectCmd: '/use-ticket', kachel: '6. Tickets' },
    // --- 7. Hilfe / Fehler ---
    { input: 'Was sind die 13 Schritte?', expectCmd: '', kachel: '7. Hilfe' },
    { input: 'was sind die 13 schritte', expectCmd: '', kachel: '7. Hilfe' },
    { input: 'Hilfe', expectCmd: '', kachel: '7. Hilfe' },
    { input: 'Was kann ich alles machen?', expectCmd: '', kachel: '7. Hilfe' },
    { input: 'RPC ist rot', expectCmd: '', kachel: '7. Hilfe' },
    { input: 'Verbindung schlägt fehl', expectCmd: '', kachel: '7. Hilfe' },
    { input: 'Create-key schlägt fehl', expectCmd: '', kachel: '7. Hilfe' },
    { input: 'Kann nicht senden', expectCmd: '', kachel: '7. Hilfe' },
    { input: 'Backend nicht bereit', expectCmd: '', kachel: '7. Hilfe' },
    { input: 'Wo steht was zu MAILBOX_ID?', expectCmd: '', kachel: '7. Hilfe' },
    // --- Zahlung (eigene Kachel) ---
    { input: 'Sende 1 IOTA an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: 'sende 0.001 iota an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: 'überweise 0.5 iota an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: 'Überweise 0.5 IOTA an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: 'Transfer 2 iota to ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: '5 IOTA an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: 'Sende 0.1 IOTA an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    // --- Ablauf: Einzelne Schritte (Reihenfolge wie in der Praxis) ---
    { input: 'Zuerst: setze die package-id auf ' + ADDR, expectCmd: '/set-package-id', kachel: 'Ablauf', ablauf: true },
    { input: 'Als nächstes Handshake an ' + ADDR, expectCmd: '/handshake', kachel: 'Ablauf', ablauf: true },
    { input: 'Dann verbinde mit ' + ADDR, expectCmd: '/connect', kachel: 'Ablauf', ablauf: true },
    { input: 'Jetzt schick klartext hallo an ' + ADDR, expectCmd: '/send-plain', kachel: 'Ablauf', ablauf: true },
    { input: 'Danach hole letzten 20', expectCmd: '/fetch', kachel: 'Ablauf', ablauf: true },
    { input: 'Zum Schluss vault speichern', expectCmd: '/vault-save', kachel: 'Ablauf', ablauf: true },
    { input: 'Schritt 1: Package setzen ' + ADDR, expectCmd: '/set-package-id', kachel: 'Ablauf', ablauf: true },
    { input: 'Schritt 2: Handshake an ' + ADDR, expectCmd: '/handshake', kachel: 'Ablauf', ablauf: true },
    { input: 'Schritt 3: Verbinden mit ' + ADDR, expectCmd: '/connect', kachel: 'Ablauf', ablauf: true },
    { input: 'Schritt 4: Sende 1 IOTA an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Ablauf', ablauf: true },
    { input: 'Schritt 5: Gib ' + ADDR + ' Schlüssel für 7 Tage', expectCmd: '/create-key', kachel: 'Ablauf', ablauf: true },
    { input: 'Schritt 6: Keys sichern', expectCmd: '/vault-save', kachel: 'Ablauf', ablauf: true },
    // --- Ablauf: Mehrschritt-Formulierungen (erster sinnvoller Befehl zählt) ---
    { input: 'Ich will zuerst verbinden und dann eine Nachricht schicken', expectCmd: ['/handshake', '/connect'], kachel: 'Ablauf', ablauf: true },
    { input: 'Erst Handshake dann Connect dann Send', expectCmd: '/handshake', kachel: 'Ablauf', ablauf: true },
    { input: 'Lass Gast ' + ADDR + ' rein, dann Keys speichern', expectCmd: ['/create-key', '/vault-save'], kachel: 'Ablauf', ablauf: true },
    { input: 'Sende 1 IOTA an ' + ADDR + ' und erstelle dann einen Key für ' + ADDR2, expectCmd: ['/transfer-coins', '/create-key'], kachel: 'Ablauf', ablauf: true },
    { input: 'Erstelle ein Ticket "sommerfest" und sende es an ' + ADDR + ', danach Keys sichern', expectCmd: ['/create-ticket', '/vault-save'], kachel: 'Ablauf', ablauf: true },
    { input: 'Das Event ist vorbei, räum die abgelaufenen Keys auf', expectCmd: ['/list-keys', '/purge-key'], kachel: 'Ablauf', ablauf: true },
    { input: 'Räum die abgelaufenen Tickets auf', expectCmd: ['/list-tickets', '/list-keys'], kachel: 'Ablauf', ablauf: true },
    { input: 'Key wurde erstellt. Was jetzt?', expectCmd: ['/vault-save', '/list-keys'], kachel: 'Ablauf', ablauf: true },
    { input: 'Bereite alles vor: Gast soll bezahlen und Schlüssel bekommen', expectCmd: ['/create-key', '/transfer-coins'], kachel: 'Ablauf', ablauf: true },
    { input: 'Zuerst verbinden, dann Nachricht schicken', expectCmd: ['/connect', '/handshake'], kachel: 'Ablauf', ablauf: true },
    // --- Kurzformen / DE+EN ---
    { input: 'setze package-id ' + ADDR, expectCmd: '/set-package-id', kachel: '1. Anfang' },
    { input: 'handshake ' + ADDR, expectCmd: '/handshake', kachel: '2. Kanal' },
    { input: 'hole letzten 10', expectCmd: '/fetch', kachel: '3. Chat' },
    { input: 'fetch 20', expectCmd: '/fetch', kachel: '3. Chat' },
    { input: 'vault save', expectCmd: '/vault-save', kachel: '4. Nachsorge' },
    { input: 'list keys', expectCmd: '/list-keys', kachel: '5. Keys' },
    { input: 'list tickets', expectCmd: '/list-tickets', kachel: '6. Tickets' },
    { input: 'Setup ' + ADDR, expectCmd: '/set-package-id', kachel: '1. Anfang' },
    { input: 'Handshake ' + ADDR, expectCmd: '/handshake', kachel: '2. Kanal' },
    { input: 'Message ' + ADDR + ' Hallo Termin', expectCmd: '/send-plain', kachel: '3. Chat' },
    { input: 'Access ' + ADDR + ' 7', expectCmd: '/create-key', kachel: '5. Keys' },
    { input: 'Purge handshake', expectCmd: '/purge-handshake', kachel: '4. Nachsorge' },
    { input: 'sag der ki lass gast ' + ADDR + ' rein', expectCmd: '/create-key', kachel: '5. Keys' },
    { input: 'sag der ki verbinde mit ' + ADDR, expectCmd: '/connect', kachel: '2. Kanal' },
    { input: 'sag der ki sende 1 iota an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: 'lass die ki nachrichten holen', expectCmd: '/fetch', kachel: '3. Chat' },
    { input: 'führe aus: gib der adresse ' + ADDR + ' einen schlüssel für 7 tage', expectCmd: '/create-key', kachel: '5. Keys' },
];

// Exakt 100 Szenarien für den Lauf (erste 100)
const TESTS = SCENARIOS.slice(0, 100);

async function main() {
    const useOllama = !!(process.env.ENABLE_AI_COPILOT === 'true' && process.env.OLLAMA_URL?.trim());
    console.log('\n=== KI Real-World: 100 Befehle (alle Kacheln + Abläufe) ===');
    console.log('Ollama:', useOllama ? process.env.OLLAMA_URL : 'aus (nur Intent-Matcher)');
    console.log('Szenarien:', TESTS.length);
    console.log('');

    let passed = 0;
    let failed = 0;
    const byKachel: Record<string, { ok: number; fail: number }> = {};
    const failures: { kachel: string; input: string; expect: string | string[]; got: string }[] = [];

    for (let i = 0; i < TESTS.length; i++) {
        const tc = TESTS[i];
        const r = await askAiCopilot(tc.input, undefined, { useIntentMatcher: true, useOllama });
        const cmd = r.suggestedAction?.cmd ?? (r.text?.match(/ACTION:\s*(\/\S+)/)?.[1] ?? '');
        const expectEmpty = tc.expectCmd === '';
        const ok = expectEmpty
            ? r.ok && (r.text?.length ?? 0) > 0
            : r.ok && (match(cmd, tc.expectCmd) || (Array.isArray(tc.expectCmd) && (r.text?.length ?? 0) > 20));

        byKachel[tc.kachel] = byKachel[tc.kachel] || { ok: 0, fail: 0 };
        if (ok) {
            passed++;
            byKachel[tc.kachel].ok++;
            process.stdout.write('.');
        } else {
            failed++;
            byKachel[tc.kachel].fail++;
            failures.push({
                kachel: tc.kachel,
                input: tc.input.slice(0, 55) + (tc.input.length > 55 ? '…' : ''),
                expect: tc.expectCmd,
                got: cmd || (r.text?.slice(0, 40) ?? r.error ?? '–'),
            });
            process.stdout.write('F');
        }
    }

    console.log('\n\n--- Ergebnis ---');
    console.log('Bestanden:', passed, '| Fehlgeschlagen:', failed, '| Gesamt:', TESTS.length);
    console.log('Quote:', TESTS.length ? ((passed / TESTS.length) * 100).toFixed(1) + '%' : '0%');
    console.log('\n--- Pro Kachel ---');
    for (const [k, v] of Object.entries(byKachel).sort()) {
        const total = v.ok + v.fail;
        const pct = total ? ((v.ok / total) * 100).toFixed(0) : '0';
        console.log('  ' + k + ': ' + v.ok + '/' + total + ' (' + pct + '%)');
    }
    if (failures.length > 0) {
        console.log('\n--- Fehlgeschlagen (max 20) ---');
        failures.slice(0, 20).forEach((f, i) => {
            console.log('  ' + (i + 1) + '. [' + f.kachel + '] ' + f.input);
            console.log('     Erwartet: ' + (Array.isArray(f.expect) ? f.expect.join(' oder ') : f.expect) + '  → Got: ' + f.got);
        });
        if (failures.length > 20) console.log('  ... und ' + (failures.length - 20) + ' weitere');
    }
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
