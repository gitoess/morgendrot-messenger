/**
 * Deckt alle Befehle des Programms mit der KI ab: Intent-Matcher + optional Ollama.
 * Jeder Befehl hat mindestens eine Testphrase. So werden alle Funktionen/Optionen/Kombinationen
 * einmal von der KI durchgespielt (Empfehlung erzeugt); Ausführung auf der Chain ist separat.
 *
 * Nutzung:
 *   npx tsx scripts/run-ai-copilot-command-coverage.ts
 *   # Mit Ollama (ENABLE_AI_COPILOT=true, OLLAMA_URL):
 *   ENABLE_AI_COPILOT=true npx tsx scripts/run-ai-copilot-command-coverage.ts
 */
import 'dotenv/config';
import { askAiCopilot } from '../src/ai-copilot.js';
import { tryIntentMatch } from '../src/ai-intent-matcher.js';

const ADDR = '0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5';
const ADDR2 = '0x' + 'b'.repeat(64);
const OBJ_ID = '0x' + '1'.repeat(64);

type Case = { phrase: string; expectCmd: string; group: string };

const COVERAGE: Case[] = [
    // Kurzbefehle (Stichwort-Kaskade)
    { phrase: 'Setup ' + ADDR, expectCmd: '/set-package-id', group: 'Kurzbefehle' },
    { phrase: 'Handshake ' + ADDR, expectCmd: '/handshake', group: 'Kurzbefehle' },
    { phrase: 'Message ' + ADDR + ' Hallo Termin steht', expectCmd: '/send-plain', group: 'Kurzbefehle' },
    { phrase: 'Access ' + ADDR + ' 7', expectCmd: '/create-key', group: 'Kurzbefehle' },
    { phrase: 'Purge handshake', expectCmd: '/purge-handshake', group: 'Kurzbefehle' },
    { phrase: 'Purge ' + OBJ_ID, expectCmd: '/purge-key', group: 'Kurzbefehle' },

    // Fundament / Säule 1
    { phrase: '/set-package-id ' + ADDR, expectCmd: '/set-package-id', group: 'Fundament' },
    { phrase: 'setze die package-id auf ' + ADDR, expectCmd: '/set-package-id', group: 'Fundament' },
    { phrase: 'package setzen auf ' + ADDR, expectCmd: '/set-package-id', group: 'Fundament' },

    // Kanal / Handshake / Connect
    { phrase: 'handshake an ' + ADDR, expectCmd: '/handshake', group: 'Kanal' },
    { phrase: 'ecdh schlüsseltausch mit ' + ADDR, expectCmd: '/handshake', group: 'Kanal' },
    { phrase: 'sichere leitung zu ' + ADDR + ' aufbauen', expectCmd: '/handshake', group: 'Kanal' },
    { phrase: 'verbinde mit ' + ADDR, expectCmd: '/connect', group: 'Kanal' },
    { phrase: 'chat mit ' + ADDR + ' starten', expectCmd: '/connect', group: 'Kanal' },
    { phrase: 'sende verschlüsselt hallo an ' + ADDR, expectCmd: '/handshake', group: 'Kanal' },
    { phrase: 'sende nachricht "ki läuft" an ' + ADDR, expectCmd: '/send-plain', group: 'Kanal' }, // Compliance: 0x0748… nur „Ki läuft“

    // Aktivität / Nachrichten / IOTA
    { phrase: 'schick klartext hallo an ' + ADDR, expectCmd: '/send-plain', group: 'Aktivität' },
    { phrase: 'sende unverschlüsselte nachricht ohne handshake "hallo iota" an ' + ADDR, expectCmd: '/send-plain', group: 'Aktivität' },
    { phrase: 'sende unverschlüsselte nachricht ohne handshake  "hallo iota "an ' + ADDR, expectCmd: '/send-plain', group: 'Aktivität' },
    { phrase: 'sende hallo', expectCmd: '/send', group: 'Aktivität' },
    { phrase: 'verschlüsselte nachricht schicken', expectCmd: '/send', group: 'Aktivität' },
    { phrase: 'hole letzten 20', expectCmd: '/fetch', group: 'Aktivität' },
    { phrase: 'hole letzte 50 nachrichten von ' + ADDR, expectCmd: '/fetch', group: 'Aktivität' },
    { phrase: 'sende 1 iota an ' + ADDR, expectCmd: '/transfer-coins', group: 'Aktivität' },
    { phrase: 'überweise 0.5 iota an ' + ADDR, expectCmd: '/transfer-coins', group: 'Aktivität' },
    { phrase: 'überweise 5 coins an ' + ADDR, expectCmd: '/transfer-coins', group: 'Aktivität' },

    // Nachsorge / Säule 4
    { phrase: 'vault speichern', expectCmd: '/vault-save', group: 'Nachsorge' },
    { phrase: 'speichere messaging-keys lokal', expectCmd: '/vault-save', group: 'Nachsorge' },
    { phrase: 'backup der keys machen', expectCmd: '/vault-save', group: 'Nachsorge' },
    { phrase: 'vault onchain', expectCmd: '/vault-onchain', group: 'Nachsorge' },
    { phrase: 'purge handshake', expectCmd: '/purge-handshake', group: 'Nachsorge' },
    { phrase: 'lösche den handshake aus der mailbox', expectCmd: '/purge-handshake', group: 'Nachsorge' },
    { phrase: 'nachricht aus mailbox löschen nonce 42', expectCmd: '/purge-msg', group: 'Nachsorge' },
    { phrase: 'emergency purge', expectCmd: '/emergency-purge', group: 'Nachsorge' },

    // Keys / Zutritt
    { phrase: 'lass gast ' + ADDR + ' rein', expectCmd: '/create-key', group: 'Keys' },
    { phrase: 'zutritt für ' + ADDR + ' für 30 tage', expectCmd: '/create-key', group: 'Keys' },
    { phrase: 'gib der adresse ' + ADDR + ' einen schlüssel für 7 tage', expectCmd: '/create-key', group: 'Keys' },
    { phrase: 'erstelle 3 keys für ' + ADDR + ' mit 14 tagen', expectCmd: '/create-keys', group: 'Keys' },
    { phrase: 'drei gäste-keys für ' + ADDR + ' anlegen', expectCmd: '/create-keys', group: 'Keys' },
    { phrase: 'gast ' + ADDR + ' soll key bekommen und bestätigung', expectCmd: '/create-key-and-notify', group: 'Keys' },
    { phrase: 'stelle ticket für gast ' + ADDR + ' aus und sag bescheid', expectCmd: '/create-key-and-notify', group: 'Keys' },
    { phrase: 'zeig mir meine accesskeys', expectCmd: '/list-keys', group: 'Keys' },
    { phrase: 'lösche den alten key mit der id ' + OBJ_ID, expectCmd: '/purge-key', group: 'Keys' },
    { phrase: 'key ' + OBJ_ID + ' für notfall-purge vorbereiten', expectCmd: '/emergency-purge-key', group: 'Keys' },
    { phrase: 'übertrage key ' + OBJ_ID + ' an ' + ADDR2, expectCmd: '/transfer-key', group: 'Keys' },

    // Tickets
    { phrase: 'Erstelle ein Ticket für hexefest und sende an Adresse ' + ADDR, expectCmd: '/create-ticket', group: 'Tickets' },
    { phrase: 'erstelle ein ticket \"baum\" und sende es an ' + ADDR, expectCmd: '/create-ticket', group: 'Tickets' },
    { phrase: 'ticket für event erstellen an ' + ADDR, expectCmd: '/create-ticket', group: 'Tickets' },
    { phrase: 'ticket für gast ' + ADDR + ' erstellen', expectCmd: '/create-ticket', group: 'Tickets' },
    { phrase: 'zeig meine tickets', expectCmd: '/list-tickets', group: 'Tickets' },
    { phrase: 'ticket ' + OBJ_ID + ' einlösen für event ' + ADDR2, expectCmd: '/use-ticket', group: 'Tickets' },
    { phrase: 'ticket ' + OBJ_ID + ' löschen', expectCmd: '/purge-ticket', group: 'Tickets' },
    { phrase: 'ticket ' + OBJ_ID + ' an ' + ADDR2 + ' übertragen', expectCmd: '/transfer-ticket', group: 'Tickets' },

    // Hilfe / Meta
    { phrase: 'was sind die 13 schritte', expectCmd: '', group: 'Hilfe' },
    { phrase: 'was kann ich alles machen', expectCmd: '', group: 'Hilfe' },
    { phrase: 'hilfe anzeigen', expectCmd: '', group: 'Hilfe' },

    // Fehler / Diagnostik
    { phrase: 'rpc ist rot', expectCmd: '', group: 'Fehler' },
    { phrase: 'create-key schlägt fehl', expectCmd: '', group: 'Fehler' },
    { phrase: 'kann nicht senden', expectCmd: '', group: 'Fehler' },
    { phrase: 'verbindung schlägt fehl', expectCmd: '', group: 'Fehler' },
];

function normalizeCmd(cmd: string): string {
    return (cmd || '').replace(/^\//, '').toLowerCase();
}

async function main() {
    console.log('=== KI-Befehl-Coverage: alle Befehle/Optionen durch Intent + optional Ollama ===\n');

    const byGroup = new Map<string, Case[]>();
    for (const c of COVERAGE) {
        if (!byGroup.has(c.group)) byGroup.set(c.group, []);
        byGroup.get(c.group)!.push(c);
    }

    let intentOk = 0;
    let intentFail = 0;
    const failedPhrases: { phrase: string; expectCmd: string; got?: string }[] = [];

    for (const [group, cases] of byGroup) {
        console.log('--- ' + group + ' ---');
        for (const tc of cases) {
            // Direkte Befehle (z. B. /set-package-id) werden von askAiCopilot via tryDirectCommand erkannt
            const isDirect = tc.phrase.trim().startsWith('/');
            const intent = isDirect ? null : tryIntentMatch(tc.phrase);
            let cmd = intent?.suggestedAction?.cmd ?? '';
            if (isDirect && !cmd) {
                const r = await askAiCopilot(tc.phrase, undefined, { useIntentMatcher: false, useOllama: false });
                cmd = r.suggestedAction?.cmd ?? '';
            }
            const match = !tc.expectCmd || normalizeCmd(cmd) === normalizeCmd(tc.expectCmd);
            const textOk = !tc.expectCmd || (intent?.ok && (intent.text?.length ?? 0) > 0);
            const ok = tc.expectCmd ? match : textOk;
            if (ok) {
                intentOk++;
                console.log('  [Intent] OK:', tc.phrase.slice(0, 55) + (tc.phrase.length > 55 ? '…' : ''));
            } else {
                intentFail++;
                failedPhrases.push({ phrase: tc.phrase, expectCmd: tc.expectCmd, got: cmd || (intent?.text?.slice(0, 30)) });
                console.log('  [Intent] FAIL:', tc.phrase.slice(0, 50), '→ erwartet', tc.expectCmd, 'got', cmd || intent?.text?.slice(0, 40));
            }
        }
    }

    console.log('\n--- askAiCopilot (Intent-Matcher, kein Ollama) ---');
    let apiOk = 0;
    let apiFail = 0;
    for (const tc of COVERAGE.slice(0, 15)) {
        if (!tc.expectCmd) continue;
        const r = await askAiCopilot(tc.phrase, undefined, { useIntentMatcher: true, useOllama: false });
        const cmd = r.suggestedAction?.cmd ?? (r.text?.match(/ACTION:\s*(\/\S+)/)?.[1] ?? '');
        const ok = r.ok && normalizeCmd(cmd) === normalizeCmd(tc.expectCmd);
        if (ok) apiOk++; else apiFail++;
    }
    console.log('  Stichprobe (15): OK', apiOk, 'FAIL', apiFail);

    const useOllama = process.env.ENABLE_AI_COPILOT === 'true' && !!process.env.OLLAMA_URL?.trim();
    if (useOllama) {
        console.log('\n--- askAiCopilot mit Ollama (RAG + LLM) – Stichprobe ---');
        const ollamaPhrases = [
            'Erstelle ein Ticket für hexefest und sende an Adresse ' + ADDR,
            'sende 1 iota an ' + ADDR,
            'was sind die 13 schritte',
        ];
        for (const phrase of ollamaPhrases) {
            try {
                const r = await askAiCopilot(phrase, { myAddressSet: true, packageIdSet: true, connected: false }, { useIntentMatcher: true, useOllama: true });
                const hasAction = r.suggestedAction || (r.text && /ACTION:\s*\/\S+/.test(r.text));
                console.log('  ', phrase.slice(0, 50) + '…', '→', r.ok ? (hasAction ? 'ACTION' : 'Text') : 'Error', r.error?.slice(0, 40));
            } catch (e) {
                console.log('  ', phrase.slice(0, 50), '→ Exception', (e as Error).message?.slice(0, 50));
            }
        }
    } else {
        console.log('\n(Ollama-Test übersprungen: ENABLE_AI_COPILOT=true und OLLAMA_URL setzen)');
    }

    console.log('\n=== Ergebnis ===');
    console.log('Intent-Matcher: OK', intentOk, 'FAIL', intentFail);
    if (failedPhrases.length > 0) {
        console.log('Fehlgeschlagene Phrasen (erwarteter Befehl):');
        failedPhrases.forEach((f) => console.log('  -', f.phrase.slice(0, 60), '→', f.expectCmd, 'got', f.got));
    }
    process.exit(intentFail > 0 ? 1 : 0);
}

main();
