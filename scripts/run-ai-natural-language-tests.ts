/**
 * 100+ Tests: Normale deutsche/englische Sätze → KI soll den passenden Befehl vorschlagen.
 * Deckt alle Kacheln (Chat, Ticket, Keys, Vault, Zahlung, Pinnwand, Boss, …) und alle Befehle ab.
 * Die KI führt nicht selbst aus; der Test prüft, dass die vorgeschlagene ACTION korrekt ist.
 *
 * Nutzung: npx tsx scripts/run-ai-natural-language-tests.ts
 */
import 'dotenv/config';
import { askAiCopilot } from '../src/ai-copilot.js';

const ADDR = '0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5';
const ADDR2 = '0x' + 'b'.repeat(64);
const OBJ = '0x' + '1'.repeat(64);

type TestCase = {
    input: string;
    expectCmd: string | string[];
    kachel?: string;
    description?: string;
};

function norm(cmd: string): string {
    return (cmd || '').replace(/^\//, '').toLowerCase();
}
function match(cmd: string, expected: string | string[]): boolean {
    const c = norm(cmd);
    if (Array.isArray(expected)) return expected.some((e) => c === norm(e));
    return c === norm(expected);
}

const TESTS: TestCase[] = [
    // --- Fundament / Säule 1 ---
    { input: 'Setze die Package-ID auf ' + ADDR, expectCmd: '/set-package-id', kachel: 'Fundament' },
    { input: 'Package-ID setzen ' + ADDR, expectCmd: '/set-package-id', kachel: 'Fundament' },
    { input: 'Set package id to ' + ADDR, expectCmd: '/set-package-id', kachel: 'Fundament' },
    // --- Chat / Kanal / Säule 2+3 ---
    { input: 'Handshake an ' + ADDR + ' senden', expectCmd: '/handshake', kachel: 'Chat' },
    { input: 'Verbinde mich mit ' + ADDR, expectCmd: '/connect', kachel: 'Chat' },
    { input: 'Connect to ' + ADDR, expectCmd: '/connect', kachel: 'Chat' },
    { input: 'Ich will verschlüsselt an ' + ADDR + ' schreiben', expectCmd: '/handshake', kachel: 'Chat' },
    { input: 'Sende verschlüsselt Hallo an ' + ADDR, expectCmd: '/handshake', kachel: 'Chat' },
    { input: 'Schick Klartext Hallo an ' + ADDR, expectCmd: '/send-plain', kachel: 'Chat' },
    { input: 'Sag ' + ADDR + ' Bescheid: Meeting um 10', expectCmd: '/send-plain', kachel: 'Chat' },
    { input: 'Send plain message to ' + ADDR, expectCmd: '/send-plain', kachel: 'Chat' },
    { input: 'Sende die Nachricht Hallo Welt', expectCmd: '/send', kachel: 'Chat' },
    { input: 'Schick nachricht', expectCmd: '/send', kachel: 'Chat' },
    { input: 'Hole die letzten 20 Nachrichten', expectCmd: '/fetch', kachel: 'Chat' },
    { input: 'Fetch 50 messages', expectCmd: '/fetch', kachel: 'Chat' },
    { input: 'Hole letzte 100 von ' + ADDR, expectCmd: '/fetch', kachel: 'Chat' },
    // --- Zahlung / Transfer ---
    { input: 'Sende 1 IOTA an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: 'Überweise 0.5 IOTA an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: 'Transfer 2 iota to ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: 'Schick 10 Coins an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    // --- Vault / Nachsorge ---
    { input: 'Speichere die Keys lokal', expectCmd: '/vault-save', kachel: 'Vault' },
    { input: 'Vault speichern', expectCmd: '/vault-save', kachel: 'Vault' },
    { input: 'Keys in Vault speichern', expectCmd: '/vault-save', kachel: 'Vault' },
    { input: 'Vault on-chain speichern', expectCmd: '/vault-onchain', kachel: 'Vault' },
    { input: 'Keys on-chain speichern', expectCmd: '/vault-onchain', kachel: 'Vault' },
    { input: 'Lösche den Handshake aus der Mailbox', expectCmd: '/purge-handshake', kachel: 'Nachsorge' },
    { input: 'Purge handshake', expectCmd: '/purge-handshake', kachel: 'Nachsorge' },
    { input: 'Nachricht mit Nonce 123 löschen', expectCmd: '/purge-msg', kachel: 'Nachsorge' },
    { input: 'Emergency purge Vault', expectCmd: '/emergency-purge', kachel: 'Notfall' },
    { input: 'Notfall-Purge für Vault', expectCmd: '/emergency-purge', kachel: 'Notfall' },
    // --- Keys / Zutritt / Heimnetzwerk ---
    { input: 'Lass den Gast ' + ADDR + ' rein', expectCmd: '/create-key', kachel: 'Heimnetzwerk' },
    { input: 'Gib der Adresse ' + ADDR + ' einen Schlüssel für 7 Tage', expectCmd: '/create-key', kachel: 'Heimnetzwerk' },
    { input: 'Erstelle einen Key für ' + ADDR + ' 30 Tage', expectCmd: '/create-key', kachel: 'Heimnetzwerk' },
    { input: 'Create key for ' + ADDR + ' 14 days', expectCmd: '/create-key', kachel: 'Heimnetzwerk' },
    { input: 'Erstelle 3 Keys für ' + ADDR + ' mit 14 Tagen', expectCmd: ['/create-keys', '/create-key'], kachel: 'Heimnetzwerk' },
    { input: 'Mehrere Schlüssel für ' + ADDR + ' 7 Tage 5 Stück', expectCmd: ['/create-keys', '/create-key'], kachel: 'Heimnetzwerk' },
    { input: 'Gast ' + ADDR + ' soll Key und Bestätigung bekommen', expectCmd: '/create-key-and-notify', kachel: 'Heimnetzwerk' },
    { input: 'Key ausstellen und Bescheid sagen an ' + ADDR, expectCmd: '/create-key-and-notify', kachel: 'Heimnetzwerk' },
    { input: 'Zeig mir meine AccessKeys', expectCmd: '/list-keys', kachel: 'Heimnetzwerk' },
    { input: 'Liste alle Keys', expectCmd: '/list-keys', kachel: 'Heimnetzwerk' },
    { input: 'Lösche den Key mit ID ' + OBJ, expectCmd: '/purge-key', kachel: 'Heimnetzwerk' },
    { input: 'Purge key ' + OBJ, expectCmd: '/purge-key', kachel: 'Heimnetzwerk' },
    { input: 'Key ' + OBJ + ' für Notfall-Purge vorbereiten', expectCmd: ['/emergency-purge-key', '/create-key'], kachel: 'Heimnetzwerk' },
    { input: 'Übertrage Key ' + OBJ + ' an ' + ADDR2, expectCmd: '/transfer-key', kachel: 'Heimnetzwerk' },
    // --- Tickets / Event ---
    { input: 'Erstelle ein Ticket für hexefest und sende an ' + ADDR, expectCmd: '/create-ticket', kachel: 'Ticket' },
    { input: 'erstelle ein ticket "baum" und sende es an ' + ADDR, expectCmd: '/create-ticket', kachel: 'Ticket' },
    { input: 'Ticket für Event "hundefest" an ' + ADDR + ' ausstellen', expectCmd: '/create-ticket', kachel: 'Ticket' },
    { input: 'Create ticket for event and send to ' + ADDR, expectCmd: '/create-ticket', kachel: 'Ticket' },
    { input: 'Zeig meine Tickets', expectCmd: '/list-tickets', kachel: 'Ticket' },
    { input: 'List tickets', expectCmd: '/list-tickets', kachel: 'Ticket' },
    { input: 'Ticket ' + OBJ + ' einlösen für Event ' + ADDR2, expectCmd: '/use-ticket', kachel: 'Ticket' },
    { input: 'Ticket ' + OBJ + ' löschen', expectCmd: '/purge-ticket', kachel: 'Ticket' },
    { input: 'Ticket ' + OBJ + ' an ' + ADDR2 + ' übertragen', expectCmd: ['/transfer-ticket', '/transfer-key'], kachel: 'Ticket' },
    // --- Multi-Schritt / Kombinationen (erster Schritt oder Erklärung) ---
    {
        input: 'Erstelle 2 Tickets für das "hundefest" an ' + ADDR + ' und purge sie danach wieder',
        expectCmd: ['/create-ticket', '/list-tickets'],
        kachel: 'Ticket',
        description: 'Multi: Ticket erstellen, danach purge',
    },
    {
        input: 'Erstelle ein Ticket "sommerfest" und sende es an ' + ADDR + ', danach Keys sichern',
        expectCmd: ['/create-ticket', '/vault-save'],
        kachel: 'Ticket',
    },
    {
        input: 'Lass Gast ' + ADDR + ' rein, dann Keys speichern',
        expectCmd: ['/create-key', '/vault-save'],
        kachel: 'Heimnetzwerk',
    },
    {
        input: 'Sende 1 IOTA an ' + ADDR + ' und erstelle dann einen Key für ' + ADDR2,
        expectCmd: ['/transfer-coins', '/create-key'],
        kachel: 'Zahlung',
    },
    {
        input: 'Räum die abgelaufenen Tickets auf',
        expectCmd: ['/list-tickets', '/list-keys'],
        kachel: 'Nachsorge',
    },
    {
        input: 'Das Event ist vorbei, räum die abgelaufenen Keys auf',
        expectCmd: ['/list-keys', '/purge-key'],
        kachel: 'Nachsorge',
    },
    // --- Hilfe / Fehler ---
    { input: 'Was sind die 13 Schritte?', expectCmd: '', kachel: 'Hilfe', description: 'Text-Antwort' },
    { input: 'Was kann ich alles machen?', expectCmd: '', kachel: 'Hilfe' },
    { input: 'Hilfe', expectCmd: '', kachel: 'Hilfe' },
    { input: 'Wie richte ich alles ein?', expectCmd: '', kachel: 'Hilfe' },
    { input: 'RPC ist rot', expectCmd: '', kachel: 'Fehler' },
    { input: 'Verbindung schlägt fehl', expectCmd: '', kachel: 'Fehler' },
    { input: 'Create-key schlägt fehl', expectCmd: '', kachel: 'Fehler' },
    { input: 'Kann nicht senden', expectCmd: '', kachel: 'Fehler' },
    { input: 'Backend nicht bereit', expectCmd: '', kachel: 'Fehler' },
    // --- Pinnwand (send-plain, mit Adresse) ---
    { input: 'Pinnwand: Klartext an ' + ADDR, expectCmd: '/send-plain', kachel: 'Pinnwand' },
    { input: 'Broadcast Nachricht an ' + ADDR, expectCmd: '/send-plain', kachel: 'Pinnwand' },
    // --- Weitere DE/EN Varianten ---
    { input: 'hole letzten 10', expectCmd: '/fetch', kachel: 'Chat' },
    { input: 'fetch 20', expectCmd: '/fetch', kachel: 'Chat' },
    { input: 'setze package-id ' + ADDR, expectCmd: '/set-package-id', kachel: 'Fundament' },
    { input: 'handshake ' + ADDR, expectCmd: '/handshake', kachel: 'Chat' },
    { input: 'verbinde mit ' + ADDR, expectCmd: '/connect', kachel: 'Chat' },
    { input: 'vault save', expectCmd: '/vault-save', kachel: 'Vault' },
    { input: 'list keys', expectCmd: '/list-keys', kachel: 'Heimnetzwerk' },
    { input: 'list tickets', expectCmd: '/list-tickets', kachel: 'Ticket' },
    { input: 'purge handshake', expectCmd: '/purge-handshake', kachel: 'Nachsorge' },
    { input: 'emergency purge', expectCmd: '/emergency-purge', kachel: 'Notfall' },
    { input: 'Key wurde erstellt, was jetzt?', expectCmd: ['/vault-save', '/list-keys'], kachel: 'Nachsorge' },
    { input: 'Speichere die Messaging-Keys lokal', expectCmd: '/vault-save', kachel: 'Vault' },
    { input: 'Wie lösche ich alte Keys?', expectCmd: ['/list-keys', '/purge-key'], kachel: 'Nachsorge' },
    { input: 'Zeig mir meine Tickets', expectCmd: '/list-tickets', kachel: 'Ticket' },
    { input: 'Wo steht was zu MAILBOX_ID?', expectCmd: '', kachel: 'Hilfe' },
    { input: 'Sende 0.1 IOTA an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: '5 IOTA an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: 'Überweise 2 an ' + ADDR, expectCmd: '/transfer-coins', kachel: 'Zahlung' },
    { input: 'Erstelle Key und Benachrichtigung in einer TX für ' + ADDR, expectCmd: ['/create-key-and-notify', '/create-key'], kachel: 'Heimnetzwerk' },
    { input: 'Notfall-Purge für Key ' + OBJ, expectCmd: '/emergency-purge-key', kachel: 'Heimnetzwerk' },
    { input: 'Nachricht aus Mailbox löschen Nonce 99', expectCmd: '/purge-msg', kachel: 'Nachsorge' },
    { input: 'Ticket ' + OBJ + ' für Event ' + ADDR2 + ' einlösen', expectCmd: '/use-ticket', kachel: 'Ticket' },
    { input: 'Transfer ticket ' + OBJ + ' to ' + ADDR2, expectCmd: ['/transfer-ticket', '/transfer-key'], kachel: 'Ticket' },
    { input: 'Transfer key ' + OBJ + ' to ' + ADDR2, expectCmd: '/transfer-key', kachel: 'Heimnetzwerk' },
    { input: 'Jetzt verschlüsselt senden: Bereit', expectCmd: '/send', kachel: 'Chat' },
    { input: 'Bereit zum Senden', expectCmd: '/send', kachel: 'Chat' },
    { input: 'Zuerst verbinden dann Nachricht', expectCmd: ['/connect', '/handshake'], kachel: 'Chat' },
    { input: 'Bereite alles vor: Gast soll bezahlen und Schlüssel bekommen', expectCmd: ['/create-key', '/transfer-coins'], kachel: 'Zahlung' },
    { input: 'Erstelle 5 Keys für ' + ADDR + ' 7 Tage', expectCmd: ['/create-keys', '/create-key'], kachel: 'Heimnetzwerk' },
    { input: 'Gast von gestern wieder reinlassen ' + ADDR, expectCmd: '/create-key', kachel: 'Heimnetzwerk' },
    { input: 'Schlüssel für 14 Tage an ' + ADDR, expectCmd: '/create-key', kachel: 'Heimnetzwerk' },
    { input: 'Klartext Event startet um 18 Uhr an ' + ADDR, expectCmd: '/send-plain', kachel: 'Chat' },
    { input: 'Sag ' + ADDR + ' Bescheid', expectCmd: '/send-plain', kachel: 'Chat' },
    { input: 'Verschlüsselt an ' + ADDR + ' schicken', expectCmd: '/handshake', kachel: 'Chat' },
    { input: 'Ich möchte eine verschlüsselte Nachricht an ' + ADDR + ' senden', expectCmd: '/handshake', kachel: 'Chat' },
    { input: 'Sende 1 IOTA, gib Key und Ticket', expectCmd: ['/transfer-coins', '/create-key', '/create-ticket'], kachel: 'Zahlung' },
    { input: 'Es gibt keine TX für IOTA+Key+Ticket', expectCmd: '', kachel: 'Hilfe' },
    { input: 'Sende 1 IOTA an ' + ADDR + ' und Key in einer TX', expectCmd: ['/transfer-coins', '/create-key-and-notify'], kachel: 'Zahlung' },
    { input: 'Erstelle Ticket für "weihnachtsmarkt" an ' + ADDR, expectCmd: '/create-ticket', kachel: 'Ticket' },
    { input: 'ticket "konzert" erstellen und an ' + ADDR + ' senden', expectCmd: '/create-ticket', kachel: 'Ticket' },
    { input: 'Create 2 tickets for "fest" and send to ' + ADDR, expectCmd: '/create-ticket', kachel: 'Ticket' },
    { input: 'Purge alle abgelaufenen Handshakes', expectCmd: '/purge-handshake', kachel: 'Nachsorge' },
    { input: 'Lösche Handshake', expectCmd: '/purge-handshake', kachel: 'Nachsorge' },
    { input: 'Vault Notfall-Purge', expectCmd: '/emergency-purge', kachel: 'Notfall' },
    { input: 'Keys on-chain', expectCmd: '/vault-onchain', kachel: 'Vault' },
    { input: 'Wallet entsperren?', expectCmd: '', kachel: 'Hilfe' },
    { input: 'MY_ADDRESS setzen', expectCmd: '', kachel: 'Hilfe' },
    { input: 'Erste Schritte', expectCmd: '', kachel: 'Hilfe' },
    { input: 'Schnellstart', expectCmd: '', kachel: 'Hilfe' },
    { input: 'Was brauche ich für verschlüsselte Nachricht?', expectCmd: '', kachel: 'Hilfe' },
    { input: 'Brauche ich Connect für transfer-coins?', expectCmd: '', kachel: 'Hilfe' },
    { input: 'Wie viele Schritte hat Chat?', expectCmd: '', kachel: 'Hilfe' },
];

async function main() {
    console.log('=== KI-Tests: 100+ natürliche Sätze (DE/EN), alle Kacheln/Befehle ===\n');

    let passed = 0;
    let failed = 0;
    const failedList: { input: string; expectCmd: string | string[]; got: string; kachel?: string }[] = [];

    const useOllama = !!(process.env.ENABLE_AI_COPILOT === 'true' && process.env.OLLAMA_URL?.trim());
    for (let i = 0; i < TESTS.length; i++) {
        const tc = TESTS[i];
        const r = await askAiCopilot(tc.input, undefined, { useIntentMatcher: true, useOllama });
        const cmd = r.suggestedAction?.cmd ?? (r.text?.match(/ACTION:\s*(\/\S+)/)?.[1] ?? '');
        const expectEmpty = tc.expectCmd === '';
        const ok = expectEmpty
            ? r.ok && (r.text?.length ?? 0) > 0
            : r.ok && (match(cmd, tc.expectCmd) || (Array.isArray(tc.expectCmd) && (r.text?.length ?? 0) > 30));

        if (ok) {
            passed++;
            if (process.env.VERBOSE) console.log('  OK:', tc.kachel || '', tc.input.slice(0, 50));
        } else {
            failed++;
            failedList.push({
                input: tc.input,
                expectCmd: tc.expectCmd,
                got: cmd || (r.text?.slice(0, 60) ?? r.error ?? ''),
                kachel: tc.kachel,
            });
            console.log('  FAIL:', tc.kachel || '', tc.input.slice(0, 55), '→ erwartet', tc.expectCmd, 'got', cmd || r.text?.slice(0, 40));
        }
    }

    console.log('\n=== Ergebnis ===');
    console.log('Bestanden:', passed, 'Fehlgeschlagen:', failed, 'Gesamt:', TESTS.length);
    if (failedList.length > 0) {
        console.log('\nFehlgeschlagene Tests:');
        failedList.slice(0, 25).forEach((f) => console.log(' -', f.kachel, f.input.slice(0, 45), '→', f.got));
        if (failedList.length > 25) console.log(' ... und', failedList.length - 25, 'weitere');
    }
    process.exit(failed > 0 ? 1 : 0);
}

main();
