/**
 * Führt viele Real-World-Phrasen durch die KI (Intent + optional Ollama), zeichnet Ergebnisse auf
 * und gibt das Wissen an die KI weiter: execution-traces.jsonl (RAG), corrections.txt, Dataset-Anreicherung.
 *
 * Aufruf:
 *   npx tsx scripts/run-realworld-1000-and-export.ts
 *   # Mit optionaler Ausführung gegen API (Stichprobe):
 *   API_BASE=http://127.0.0.1:3342 TARGET_ADDRESS=0x… npx tsx scripts/run-realworld-1000-and-export.ts
 *   # Mit Ollama für Stichprobe (langsamer):
 *   ENABLE_AI_COPILOT=true OLLAMA_URL=http://127.0.0.1:11434 npx tsx scripts/run-realworld-1000-and-export.ts
 *
 * Ausgabe:
 *   ai-training/real-world-outcomes.jsonl  – alle Phrasen + KI-Vorschläge + Match/Erwartung
 *   ai-training/execution-traces.jsonl    – angehängt: ausgeführte Befehle (für RAG)
 *   ai-training/corrections.txt           – angehängt: Phrase | richtige ACTION (bei Fehlern)
 *   ai-training/realworld-dataset-additions.jsonl – neue Few-Shot-Kandidaten (Match-Fälle)
 *
 * Wissen an KI weitergeben:
 *   1. RAG: npm run build:rag-chunks && npm run build:rag-embeddings (lädt execution-traces + real-world-outcomes)
 *   2. Few-Shot: Zeilen aus realworld-dataset-additions.jsonl in morgendrot-dataset.jsonl einfügen (optional)
 */
import 'dotenv/config';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { askAiCopilot } from '../src/ai-copilot.js';
import { tryIntentMatch } from '../src/ai-intent-matcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AI_TRAINING = join(ROOT, 'ai-training');

const API_BASE = (process.env.API_BASE || '').replace(/\/$/, '');
const TARGET_ADDRESS = process.env.TARGET_ADDRESS || process.env.PARTNER_ADDRESS || '0x' + 'a'.repeat(64);
const USE_OLLAMA = process.env.ENABLE_AI_COPILOT === 'true' && !!process.env.OLLAMA_URL?.trim();
const MAX_PHRASES = Math.min(1000, parseInt(process.env.REALWORLD_MAX || '1000', 10) || 1000);
const EXECUTE_SAMPLE = API_BASE ? Math.min(100, parseInt(process.env.REALWORLD_EXECUTE || '50', 10) || 50) : 0;

type PhraseTemplate = { template: string; expectCmd: string; fill: (i: number) => string };
const OBJ_ID = (suffix: string) => '0x' + suffix.padStart(64, '0').slice(-64);

/** Erzeugt viele Phrasen aus Templates mit Variation (Adressen, Zahlen). */
function buildPhraseList(targetAddr: string, limit: number): { phrase: string; expectCmd: string }[] {
    const templates: PhraseTemplate[] = [
        { template: 'setze die package-id auf {pkg}', expectCmd: '/set-package-id', fill: (i) => (i % 3 === 0 ? '0x' + String(i).padStart(64, '0').slice(-64) : '0x' + 'b'.repeat(64)) },
        { template: 'handshake an {addr}', expectCmd: '/handshake', fill: (i) => targetAddr },
        { template: 'verbinde mit {addr}', expectCmd: '/connect', fill: (i) => targetAddr },
        { template: 'sichere leitung zu {addr} aufbauen', expectCmd: '/handshake', fill: (i) => targetAddr },
        { template: 'sende nachricht "{text}" an {addr}', expectCmd: '/send-plain', fill: (i) => ['ki läuft', 'hallo', 'test', 'ok', 'danke'][i % 5] + '|' + targetAddr },
        { template: 'schick klartext {text} an {addr}', expectCmd: '/send-plain', fill: (i) => ['hallo', 'test'][i % 2] + '|' + targetAddr },
        { template: 'hole letzten {n}', expectCmd: '/fetch', fill: (i) => String([10, 20, 50, 100][i % 4]) },
        { template: 'hole letzte {n} nachrichten von {addr}', expectCmd: '/fetch', fill: (i) => String([20, 50][i % 2]) + '|' + targetAddr },
        { template: 'sende hallo', expectCmd: '/send', fill: () => '' },
        { template: 'verschlüsselte nachricht schicken', expectCmd: '/send', fill: () => '' },
        { template: 'sende {iota} iota an {addr}', expectCmd: '/transfer-coins', fill: (i) => ['0.001', '0.1', '0.5', '1', '5'][i % 5] + '|' + targetAddr },
        { template: 'überweise {iota} iota an {addr}', expectCmd: '/transfer-coins', fill: (i) => ['0.5', '1'][i % 2] + '|' + targetAddr },
        { template: 'vault speichern', expectCmd: '/vault-save', fill: () => '' },
        { template: 'speichere messaging-keys lokal', expectCmd: '/vault-save', fill: () => '' },
        { template: 'vault onchain', expectCmd: '/vault-onchain', fill: () => '' },
        { template: 'purge handshake', expectCmd: '/purge-handshake', fill: () => '' },
        { template: 'lösche den handshake aus der mailbox', expectCmd: '/purge-handshake', fill: () => '' },
        { template: 'nachricht aus mailbox löschen nonce {n}', expectCmd: '/purge-msg', fill: (i) => String((i % 50) + 1) },
        { template: 'emergency purge', expectCmd: '/emergency-purge', fill: () => '' },
        { template: 'zutritt für {addr} für {d} tage', expectCmd: '/create-key', fill: (i) => targetAddr + '|' + [7, 14, 30][i % 3] },
        { template: 'gib der adresse {addr} einen schlüssel für {d} tage', expectCmd: '/create-key', fill: (i) => targetAddr + '|' + [7, 30][i % 2] },
        { template: 'drei gäste-keys für {addr}', expectCmd: '/create-keys', fill: () => targetAddr },
        { template: 'erstelle 3 keys für {addr} mit {d} tagen', expectCmd: '/create-keys', fill: (i) => targetAddr + '|' + [14, 30][i % 2] },
        { template: 'gast {addr} soll key bekommen und bestätigung', expectCmd: '/create-key-and-notify', fill: () => targetAddr },
        { template: 'zeig mir meine accesskeys', expectCmd: '/list-keys', fill: () => '' },
        { template: 'lösche den alten key mit der id {id}', expectCmd: '/purge-key', fill: (i) => OBJ_ID(String(i)) },
        { template: 'key {id} für notfall-purge vorbereiten', expectCmd: '/emergency-purge-key', fill: (i) => OBJ_ID(String(i)) },
        { template: 'übertrage key {id} an {addr}', expectCmd: '/transfer-key', fill: (i) => OBJ_ID(String(i)) + '|' + targetAddr },
        { template: 'erstelle ein ticket "{name}" und sende es an {addr}', expectCmd: '/create-ticket', fill: (i) => ['ki-test', 'event', 'hexefest'][i % 3] + '|' + targetAddr },
        { template: 'ticket für event erstellen an {addr}', expectCmd: '/create-ticket', fill: () => targetAddr },
        { template: 'zeig meine tickets', expectCmd: '/list-tickets', fill: () => '' },
        { template: 'ticket {id} einlösen für event {eid}', expectCmd: '/use-ticket', fill: (i) => OBJ_ID(String(i)) + '|' + OBJ_ID('e') },
        { template: 'ticket {id} löschen', expectCmd: '/purge-ticket', fill: (i) => OBJ_ID(String(i)) },
        { template: 'ticket {id} notfall-purge vorbereiten', expectCmd: '/emergency-purge-ticket', fill: (i) => OBJ_ID(String(i)) },
        { template: 'ticket {id} an {addr} übertragen', expectCmd: '/transfer-ticket', fill: (i) => OBJ_ID(String(i)) + '|' + targetAddr },
        { template: 'hilfe anzeigen', expectCmd: '', fill: () => '' },
        { template: 'was kann ich alles machen', expectCmd: '', fill: () => '' },
        { template: 'was sind die 13 schritte', expectCmd: '', fill: () => '' },
        { template: 'Setup {pkg}', expectCmd: '/set-package-id', fill: (i) => '0x' + String(i).padStart(64, '0').slice(-64) },
        { template: 'Handshake {addr}', expectCmd: '/handshake', fill: () => targetAddr },
        { template: 'Message {addr} Hallo Termin', expectCmd: '/send-plain', fill: () => targetAddr },
        { template: 'Access {addr} 7', expectCmd: '/create-key', fill: () => targetAddr },
        { template: 'Purge handshake', expectCmd: '/purge-handshake', fill: () => '' },
        { template: 'lass gast {addr} rein', expectCmd: '/create-key', fill: () => targetAddr },
        { template: 'backup der keys machen', expectCmd: '/vault-save', fill: () => '' },
    ];

    const out: { phrase: string; expectCmd: string }[] = [];
    let idx = 0;
    while (out.length < limit) {
        for (const t of templates) {
            if (out.length >= limit) break;
            const parts = t.fill(idx).split('|');
            const placeholders = t.template.match(/\{\w+\}/g) || [];
            let phrase = t.template;
            placeholders.forEach((ph, pi) => {
                const val = parts[pi] ?? (ph === '{addr}' ? targetAddr : ph === '{d}' ? '30' : ph === '{n}' ? '20' : ph === '{id}' ? OBJ_ID('1') : ph === '{eid}' ? OBJ_ID('e') : '');
                phrase = phrase.replace(ph, val);
            });
            out.push({ phrase, expectCmd: t.expectCmd });
            idx++;
        }
    }
    return out.slice(0, limit);
}

function normalizeCmd(c: string): string {
    return (c || '').replace(/^\//, '').toLowerCase().trim();
}

async function runCommand(cmd: string, args: string[]): Promise<{ ok?: boolean; message?: string; error?: string }> {
    try {
        const res = await fetch(`${API_BASE}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cmd, args }),
        });
        const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
        return data;
    } catch (e) {
        return { ok: false, error: String((e as Error).message) };
    }
}

async function main() {
    console.log('\n=== Real-World 1000: Phrasen durch KI → Wissen an KI weitergeben ===\n');

    if (!existsSync(AI_TRAINING)) mkdirSync(AI_TRAINING, { recursive: true });

    const phrases = buildPhraseList(TARGET_ADDRESS, MAX_PHRASES);
    console.log('Phrasen generiert:', phrases.length);

    const outcomesPath = join(AI_TRAINING, 'real-world-outcomes.jsonl');
    const tracesPath = join(AI_TRAINING, 'execution-traces.jsonl');
    const correctionsPath = join(AI_TRAINING, 'corrections.txt');
    const datasetAddPath = join(AI_TRAINING, 'realworld-dataset-additions.jsonl');

    writeFileSync(outcomesPath, '', 'utf8');
    let matchCount = 0;
    let mismatchCount = 0;
    let executed = 0;
    let executedOk = 0;
    const corrections: string[] = [];
    const datasetAdditions: string[] = [];

    const useOllamaForSample = USE_OLLAMA && phrases.length > 50;
    const ollamaSampleSize = 30;

    for (let i = 0; i < phrases.length; i++) {
        const { phrase, expectCmd } = phrases[i];
        let suggestedCmd = '';
        let suggestedArgs: string[] = [];
        let thought = '';
        try {
            if (useOllamaForSample && i < ollamaSampleSize) {
                const r = await askAiCopilot(phrase, { myAddressSet: true, packageIdSet: true }, { useIntentMatcher: true, useOllama: true });
                suggestedCmd = r.suggestedAction?.cmd ?? '';
                suggestedArgs = r.suggestedAction?.args ?? [];
                thought = r.thought ?? r.text ?? '';
            } else {
                const intent = tryIntentMatch(phrase);
                suggestedCmd = intent?.suggestedAction?.cmd ?? '';
                suggestedArgs = intent?.suggestedAction?.args ?? [];
                if (!suggestedCmd && !intent?.textOnly) {
                    const r = await askAiCopilot(phrase, undefined, { useIntentMatcher: true, useOllama: false });
                    suggestedCmd = r.suggestedAction?.cmd ?? '';
                    suggestedArgs = r.suggestedAction?.args ?? [];
                    thought = r.thought ?? r.text ?? '';
                }
            }
        } catch (e) {
            thought = (e as Error).message?.slice(0, 200) || '';
        }

        const match = !expectCmd || normalizeCmd(suggestedCmd) === normalizeCmd(expectCmd);
        if (match) matchCount++;
        else mismatchCount++;

        let executedOkThis = false;
        if (API_BASE && EXECUTE_SAMPLE > 0 && i < EXECUTE_SAMPLE && suggestedCmd && expectCmd && match) {
            const args = suggestedArgs.length ? suggestedArgs : (expectCmd === '/fetch' ? ['20'] : expectCmd === '/list-keys' || expectCmd === '/list-tickets' ? [] : [TARGET_ADDRESS, '0.001'].slice(0, expectCmd === '/transfer-coins' ? 2 : 1));
            const result = await runCommand(suggestedCmd, args);
            executed++;
            if (result.ok) executedOk++;
            executedOkThis = result.ok === true;
            appendFileSync(
                tracesPath,
                JSON.stringify({
                    summary: phrase.slice(0, 80) + ' → ' + suggestedCmd + ' ' + (args?.slice(0, 2).join(' ') || ''),
                    outcome: result.ok ? 'success' : 'fail',
                    command: suggestedCmd,
                    message: result.message || result.error,
                }) + '\n',
                'utf8'
            );
        }

        if (!match && expectCmd) {
            const correctLine = phrase + ' | ACTION: ' + expectCmd + (suggestedArgs.length ? ' ' + suggestedArgs.join(' ') : '');
            corrections.push(correctLine);
        }
        if (match && suggestedCmd && phrase.length > 10) {
            const instruction = 'Morgendrot. Eine ACTION pro Antwort.';
            const output = (thought ? thought + ' ' : '') + 'ACTION: ' + suggestedCmd + (suggestedArgs.length ? ' ' + suggestedArgs.join(' ') : '');
            datasetAdditions.push(JSON.stringify({ instruction, input: phrase, output }) + '\n');
        }

        const outcome = {
            phrase,
            expectCmd,
            suggestedCmd,
            suggestedArgs,
            match,
            executed: executedOkThis || (executed > 0 && i < EXECUTE_SAMPLE && suggestedCmd && match),
            ok: executedOkThis,
            ts: new Date().toISOString(),
        };
        appendFileSync(outcomesPath, JSON.stringify(outcome) + '\n', 'utf8');

        if ((i + 1) % 200 === 0) console.log('  …', i + 1, 'von', phrases.length);
    }

    if (corrections.length > 0) {
        const existing = existsSync(correctionsPath) ? readFileSync(correctionsPath, 'utf8') : '';
        const header = existing.trim() ? '\n# Real-World-Export ' + new Date().toISOString() + '\n' : '';
        appendFileSync(correctionsPath, header + corrections.map((c) => c.trim()).join('\n') + '\n', 'utf8');
        console.log('Corrections angehängt:', corrections.length, '→', correctionsPath);
    }
    if (datasetAdditions.length > 0) {
        const unique = [...new Set(datasetAdditions)].slice(0, 200);
        writeFileSync(datasetAddPath, unique.join(''), 'utf8');
        console.log('Dataset-Anreicherung geschrieben:', unique.length, '→', datasetAddPath);
    }

    console.log('\n--- Ergebnis ---');
    console.log('Phrasen:', phrases.length, '| Match:', matchCount, '| Mismatch:', mismatchCount);
    if (EXECUTE_SAMPLE > 0) console.log('Ausgeführt (Stichprobe):', executed, '| OK:', executedOk);
    console.log('Outcomes:', outcomesPath);
    console.log('Wissen an KI: execution-traces (RAG), corrections.txt, realworld-dataset-additions.jsonl');
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
