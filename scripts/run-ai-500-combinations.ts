/**
 * 500 Kombinationen aus allen Kacheln inkl. mehrstufiger Abläufe durch die KI testen
 * und die Daten an die KI weitergeben (Outcomes, Corrections, Dataset, RAG).
 *
 * Aufruf: npx tsx scripts/run-ai-500-combinations.ts
 *         OLLAMA_URL=http://127.0.0.1:11434 npx tsx scripts/run-ai-500-combinations.ts
 *         SKIP_RAG_BUILD=1  → RAG/Embeddings nicht neu bauen
 */
import 'dotenv/config';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { askAiCopilot } from '../src/ai-copilot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AI_TRAINING = join(ROOT, 'ai-training');

const TARGET = process.env.TARGET_ADDRESS || process.env.PARTNER_ADDRESS || '0x' + 'a'.repeat(64);
const ADDR2 = '0x' + 'b'.repeat(64);
const ADDR3 = '0x' + 'c'.repeat(64);
const USE_OLLAMA = !!(process.env.ENABLE_AI_COPILOT === 'true' && process.env.OLLAMA_URL?.trim());
const TOTAL = Math.min(500, parseInt(process.env.AI_500_MAX || '500', 10) || 500);
const SKIP_RAG_BUILD = process.env.SKIP_RAG_BUILD === '1' || process.env.SKIP_RAG_BUILD === 'true';

const OBJ = (s: string) => '0x' + s.padStart(64, '0').slice(-64);

type Case = { phrase: string; expectCmd: string | string[]; kachel: string; multiStep?: boolean };

function norm(cmd: string): string {
    return (cmd || '').replace(/^\//, '').toLowerCase().trim();
}
function match(cmd: string, expected: string | string[]): boolean {
    const c = norm(cmd);
    if (!c) return false;
    if (Array.isArray(expected)) return expected.some((e) => c === norm(e));
    return c === norm(expected);
}

/** Template: (seed index) => [phrase, expectCmd, kachel, multiStep?] */
type Tmpl = (i: number) => [string, string | string[], string, boolean?];

/** Baut 500 Kombinationen: alle Kacheln, Varianten, mehrstufige Abläufe. */
function build500Cases(): Case[] {
    const addrs = [TARGET, ADDR2, ADDR3];
    const days = [7, 14, 30];
    const iotas = ['0.001', '0.1', '0.5', '1', '5'];
    const nums = [10, 20, 50, 100];
    const msgs = ['hallo', 'ki läuft', 'test', 'ok', 'danke', 'Meeting 10 Uhr'];
    const events = ['event', 'hexefest', 'baum', 'ki-test', 'sommerfest'];

    const templates: Tmpl[] = [
        (i) => ['Setze die Package-ID auf ' + addrs[i % 3], '/set-package-id', '1. Anfang'],
        (i) => ['Package-ID setzen ' + addrs[i % 3], '/set-package-id', '1. Anfang'],
        (i) => ['Set package id to ' + addrs[i % 3], '/set-package-id', '1. Anfang'],
        (i) => ['hilfe anzeigen', '', '1. Anfang'],
        (i) => ['was kann ich alles machen', '', '1. Anfang'],
        (i) => ['Setup ' + addrs[i % 3], '/set-package-id', '1. Anfang'],
        (i) => ['Handshake an ' + addrs[i % 3] + ' senden', '/handshake', '2. Kanal'],
        (i) => ['Verbinde mich mit ' + addrs[i % 3], '/connect', '2. Kanal'],
        (i) => ['verbinde mit ' + addrs[i % 3], '/connect', '2. Kanal'],
        (i) => ['sichere leitung zu ' + addrs[i % 3] + ' aufbauen', '/handshake', '2. Kanal'],
        (i) => ['Connect to ' + addrs[i % 3], '/connect', '2. Kanal'],
        (i) => ['handshake ' + addrs[i % 3], '/handshake', '2. Kanal'],
        (i) => ['Ich will verschlüsselt an ' + addrs[i % 3] + ' schreiben', '/handshake', '2. Kanal'],
        (i) => ['chat mit ' + addrs[i % 3] + ' starten', '/connect', '2. Kanal'],
        (i) => ['Schick Klartext ' + msgs[i % 6] + ' an ' + addrs[i % 3], '/send-plain', '3. Chat'],
        (i) => ['sende nachricht "' + msgs[i % 6] + '" an ' + addrs[i % 3], '/send-plain', '3. Chat'],
        (i) => ['schick klartext test an ' + addrs[i % 3], '/send-plain', '3. Chat'],
        (i) => ['Sende die Nachricht Hallo Welt', '/send', '3. Chat'],
        (i) => ['sende hallo', '/send', '3. Chat'],
        (i) => ['verschlüsselte nachricht schicken', '/send', '3. Chat'],
        (i) => ['Hole die letzten ' + nums[i % 4] + ' Nachrichten', '/fetch', '3. Chat'],
        (i) => ['hole letzten ' + nums[i % 4], '/fetch', '3. Chat'],
        (i) => ['hole letzte ' + nums[i % 4] + ' von ' + addrs[i % 3], '/fetch', '3. Chat'],
        (i) => ['Fetch ' + nums[i % 4] + ' messages', '/fetch', '3. Chat'],
        (i) => ['Jetzt verschlüsselt senden', '/send', '3. Chat'],
        (i) => ['Sag ' + addrs[i % 3] + ' Bescheid: Meeting um 10', '/send-plain', '3. Chat'],
        (i) => ['Vault speichern', '/vault-save', '4. Nachsorge'],
        (i) => ['speichere messaging-keys lokal', '/vault-save', '4. Nachsorge'],
        (i) => ['vault onchain', '/vault-onchain', '4. Nachsorge'],
        (i) => ['purge handshake', '/purge-handshake', '4. Nachsorge'],
        (i) => ['lösche den handshake aus der mailbox', '/purge-handshake', '4. Nachsorge'],
        (i) => ['nachricht aus mailbox löschen nonce ' + (i % 50 + 1), '/purge-msg', '4. Nachsorge'],
        (i) => ['emergency purge', '/emergency-purge', '4. Nachsorge'],
        (i) => ['backup der keys machen', '/vault-save', '4. Nachsorge'],
        (i) => ['Lösche Handshake', '/purge-handshake', '4. Nachsorge'],
        (i) => ['Keys in Vault speichern', '/vault-save', '4. Nachsorge'],
        (i) => ['Lass den Gast ' + addrs[i % 3] + ' rein', '/create-key', '5. Keys'],
        (i) => ['lass gast ' + addrs[i % 3] + ' rein', '/create-key', '5. Keys'],
        (i) => ['Gib der Adresse ' + addrs[i % 3] + ' einen Schlüssel für ' + days[i % 3] + ' Tage', '/create-key', '5. Keys'],
        (i) => ['zutritt für ' + addrs[i % 3] + ' für ' + days[i % 3] + ' tage', '/create-key', '5. Keys'],
        (i) => ['gib der adresse ' + addrs[i % 3] + ' einen schlüssel für ' + days[i % 3] + ' tage', '/create-key', '5. Keys'],
        (i) => ['Erstelle 3 Keys für ' + addrs[i % 3] + ' mit ' + days[i % 3] + ' Tagen', ['/create-keys', '/create-key'], '5. Keys'],
        (i) => ['drei gäste-keys für ' + addrs[i % 3], '/create-keys', '5. Keys'],
        (i) => ['gast ' + addrs[i % 3] + ' soll key bekommen und bestätigung', '/create-key-and-notify', '5. Keys'],
        (i) => ['zeig mir meine accesskeys', '/list-keys', '5. Keys'],
        (i) => ['lösche den alten key mit der id ' + OBJ(String(i)), '/purge-key', '5. Keys'],
        (i) => ['key ' + OBJ(String(i)) + ' für notfall-purge vorbereiten', '/emergency-purge-key', '5. Keys'],
        (i) => ['übertrage key ' + OBJ(String(i)) + ' an ' + addrs[(i + 1) % 3], '/transfer-key', '5. Keys'],
        (i) => ['Purge key ' + OBJ(String(i)), '/purge-key', '5. Keys'],
        (i) => ['Liste alle Keys', '/list-keys', '5. Keys'],
        (i) => ['erstelle ein ticket "' + events[i % 5] + '" und sende es an ' + addrs[i % 3], '/create-ticket', '6. Tickets'],
        (i) => ['ticket für event erstellen an ' + addrs[i % 3], '/create-ticket', '6. Tickets'],
        (i) => ['zeig meine tickets', '/list-tickets', '6. Tickets'],
        (i) => ['ticket ' + OBJ(String(i)) + ' einlösen für event ' + OBJ('e'), '/use-ticket', '6. Tickets'],
        (i) => ['ticket ' + OBJ(String(i)) + ' löschen', '/purge-ticket', '6. Tickets'],
        (i) => ['ticket ' + OBJ(String(i)) + ' an ' + addrs[(i + 1) % 3] + ' übertragen', ['/transfer-ticket', '/transfer-key'], '6. Tickets'],
        (i) => ['Erstelle Ticket für "weihnachtsmarkt" an ' + addrs[i % 3], '/create-ticket', '6. Tickets'],
        (i) => ['Was sind die 13 Schritte?', '', '7. Hilfe'],
        (i) => ['Hilfe', '', '7. Hilfe'],
        (i) => ['RPC ist rot', '', '7. Hilfe'],
        (i) => ['Verbindung schlägt fehl', '', '7. Hilfe'],
        (i) => ['Create-key schlägt fehl', '', '7. Hilfe'],
        (i) => ['Sende ' + iotas[i % 5] + ' IOTA an ' + addrs[i % 3], '/transfer-coins', 'Zahlung'],
        (i) => ['sende ' + iotas[i % 5] + ' iota an ' + addrs[i % 3], '/transfer-coins', 'Zahlung'],
        (i) => ['überweise ' + iotas[i % 5] + ' iota an ' + addrs[i % 3], '/transfer-coins', 'Zahlung'],
        (i) => ['Überweise ' + iotas[i % 5] + ' IOTA an ' + addrs[i % 3], '/transfer-coins', 'Zahlung'],
        (i) => ['5 IOTA an ' + addrs[i % 3], '/transfer-coins', 'Zahlung'],
        (i) => ['Zuerst setze die package-id auf ' + addrs[i % 3] + ', dann handshake an ' + addrs[(i + 1) % 3], '/set-package-id', 'Ablauf', true],
        (i) => ['Als nächstes Handshake an ' + addrs[i % 3], '/handshake', 'Ablauf', true],
        (i) => ['Dann verbinde mit ' + addrs[i % 3], '/connect', 'Ablauf', true],
        (i) => ['Jetzt schick klartext hallo an ' + addrs[i % 3], '/send-plain', 'Ablauf', true],
        (i) => ['Danach hole letzten ' + nums[i % 4], '/fetch', 'Ablauf', true],
        (i) => ['Zum Schluss vault speichern', '/vault-save', 'Ablauf', true],
        (i) => ['Schritt 1: Package setzen ' + addrs[i % 3], '/set-package-id', 'Ablauf', true],
        (i) => ['Schritt 2: Handshake an ' + addrs[i % 3], '/handshake', 'Ablauf', true],
        (i) => ['Schritt 3: Verbinden mit ' + addrs[i % 3], '/connect', 'Ablauf', true],
        (i) => ['Schritt 4: Sende ' + iotas[i % 5] + ' IOTA an ' + addrs[i % 3], '/transfer-coins', 'Ablauf', true],
        (i) => ['Schritt 5: Gib ' + addrs[i % 3] + ' Schlüssel für ' + days[i % 3] + ' Tage', '/create-key', 'Ablauf', true],
        (i) => ['Schritt 6: Keys sichern', '/vault-save', 'Ablauf', true],
        (i) => ['Erst Handshake dann Connect dann Send', ['/handshake', '/connect'], 'Ablauf', true],
        (i) => ['Ich will zuerst verbinden und dann eine Nachricht schicken', ['/handshake', '/connect'], 'Ablauf', true],
        (i) => ['Lass Gast ' + addrs[i % 3] + ' rein, dann Keys speichern', ['/create-key', '/vault-save'], 'Ablauf', true],
        (i) => ['Sende ' + iotas[i % 5] + ' IOTA an ' + addrs[i % 3] + ' und erstelle dann einen Key für ' + addrs[(i + 1) % 3], ['/transfer-coins', '/create-key'], 'Ablauf', true],
        (i) => ['Erstelle ein Ticket "' + events[i % 5] + '" und sende es an ' + addrs[i % 3] + ', danach Keys sichern', ['/create-ticket', '/vault-save'], 'Ablauf', true],
        (i) => ['Das Event ist vorbei, räum die abgelaufenen Keys auf', ['/list-keys', '/purge-key'], 'Ablauf', true],
        (i) => ['Räum die abgelaufenen Tickets auf', ['/list-tickets', '/list-keys'], 'Ablauf', true],
        (i) => ['Key wurde erstellt. Was jetzt?', ['/vault-save', '/list-keys'], 'Ablauf', true],
        (i) => ['Bereite alles vor: Gast soll bezahlen und Schlüssel bekommen', ['/create-key', '/transfer-coins'], 'Ablauf', true],
        (i) => ['Zuerst verbinden, dann Nachricht schicken', ['/connect', '/handshake'], 'Ablauf', true],
        (i) => ['sag der ki lass gast ' + addrs[i % 3] + ' rein', '/create-key', '5. Keys'],
        (i) => ['sag der ki verbinde mit ' + addrs[i % 3], '/connect', '2. Kanal'],
        (i) => ['sag der ki sende 1 iota an ' + addrs[i % 3], '/transfer-coins', 'Zahlung'],
        (i) => ['lass die ki nachrichten holen', '/fetch', '3. Chat'],
        (i) => ['führe aus: gib der adresse ' + addrs[i % 3] + ' einen schlüssel für ' + days[i % 3] + ' tage', '/create-key', '5. Keys'],
        (i) => ['Message ' + addrs[i % 3] + ' ' + msgs[i % 6], '/send-plain', '3. Chat'],
        (i) => ['Access ' + addrs[i % 3] + ' ' + days[i % 3], '/create-key', '5. Keys'],
        (i) => ['Purge handshake', '/purge-handshake', '4. Nachsorge'],
        (i) => ['list keys', '/list-keys', '5. Keys'],
        (i) => ['list tickets', '/list-tickets', '6. Tickets'],
        (i) => ['vault save', '/vault-save', '4. Nachsorge'],
        (i) => ['setze package-id ' + addrs[i % 3], '/set-package-id', '1. Anfang'],
        (i) => ['Transfer ' + (i % 5 + 1) + ' iota to ' + addrs[i % 3], '/transfer-coins', 'Zahlung'],
        (i) => [(i % 3) + 1 + ' IOTA an ' + addrs[i % 3] + ' senden', '/transfer-coins', 'Zahlung'],
        (i) => ['hole ' + ([5, 15, 25, 35, 45][i % 5]) + ' nachrichten', '/fetch', '3. Chat'],
        (i) => ['Key für ' + addrs[i % 3] + ' ' + ([1, 3, 7, 14][i % 4]) + ' Tag(e)', '/create-key', '5. Keys'],
        (i) => ['Schlüssel ' + days[i % 3] + ' Tage an ' + addrs[i % 3], '/create-key', '5. Keys'],
        (i) => ['Ticket "' + ['fest', 'konzert', 'messe', 'kongress', 'markt'][i % 5] + '" an ' + addrs[i % 3], '/create-ticket', '6. Tickets'],
        (i) => ['Nachricht "' + ['ok', 'ja', 'nein', 'danke', 'bitte'][i % 5] + '" an ' + addrs[i % 3], '/send-plain', '3. Chat'],
        (i) => ['Zuerst ' + addrs[i % 3] + ' handshake dann connect', '/handshake', 'Ablauf', true],
        (i) => ['Danach purge handshake', '/purge-handshake', 'Ablauf', true],
        (i) => ['Als nächstes ' + nums[i % 4] + ' Nachrichten holen', '/fetch', 'Ablauf', true],
        (i) => ['Schritt ' + (i % 6 + 1) + ': ' + (i % 2 ? 'verbinde mit ' + addrs[i % 3] : 'handshake ' + addrs[i % 3]), i % 2 ? '/connect' : '/handshake', 'Ablauf', true],
        (i) => ['Erstelle Key für ' + addrs[i % 3] + ' dann vault speichern', ['/create-key', '/vault-save'], 'Ablauf', true],
        (i) => ['Überweise ' + iotas[i % 5] + ' an ' + addrs[i % 3] + ' dann list-keys', ['/transfer-coins', '/list-keys'], 'Ablauf', true],
        (i) => ['was sind die 13 schritte', '', '7. Hilfe'],
        (i) => ['Wie lösche ich alte Keys?', ['/list-keys', '/purge-key'], '4. Nachsorge'],
        (i) => ['Zeig mir meine Tickets', '/list-tickets', '6. Tickets'],
        (i) => ['Wallet entsperren?', '', '7. Hilfe'],
        (i) => ['Erste Schritte', '', '7. Hilfe'],
    ];

    const seen = new Set<string>();
    const out: Case[] = [];
    for (let i = 0; i < TOTAL * 4; i++) {
        if (out.length >= TOTAL) break;
        const tmpl = templates[i % templates.length];
        const [phrase, expectCmd, kachel, multiStep] = tmpl(i);
        const key = phrase.trim();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ phrase, expectCmd, kachel, multiStep: multiStep ?? false });
    }
    return out;
}

async function main() {
    console.log('\n=== KI: 500 Kombinationen (alle Kacheln + mehrstufig) → Daten an KI ===\n');
    if (!existsSync(AI_TRAINING)) mkdirSync(AI_TRAINING, { recursive: true });

    const cases = build500Cases();
    console.log('Kombinationen:', cases.length);
    console.log('Ollama:', USE_OLLAMA ? process.env.OLLAMA_URL : 'aus');
    console.log('');

    const outcomesPath = join(AI_TRAINING, 'real-world-outcomes.jsonl');
    const correctionsPath = join(AI_TRAINING, 'corrections.txt');
    const datasetAddPath = join(AI_TRAINING, 'realworld-dataset-additions.jsonl');
    const runPath = join(AI_TRAINING, 'real-world-500-run.jsonl');

    writeFileSync(runPath, '', 'utf8');
    const corrections: string[] = [];
    const datasetAdditions: string[] = [];
    let matchCount = 0;
    let mismatchCount = 0;
    const byKachel: Record<string, { ok: number; fail: number }> = {};

    for (let i = 0; i < cases.length; i++) {
        const tc = cases[i];
        let suggestedCmd = '';
        let thought = '';
        try {
            const r = await askAiCopilot(tc.phrase, undefined, { useIntentMatcher: true, useOllama: USE_OLLAMA });
            suggestedCmd = r.suggestedAction?.cmd ?? (r.text?.match(/ACTION:\s*(\/\S+)/)?.[1] ?? '');
            thought = (r.thought ?? r.text ?? '').slice(0, 200);
        } catch (e) {
            thought = (e as Error).message?.slice(0, 150) || '';
        }

        const expectEmpty = tc.expectCmd === '';
        const ok = expectEmpty
            ? (thought?.length ?? 0) > 0
            : match(suggestedCmd, tc.expectCmd) || (Array.isArray(tc.expectCmd) && (thought?.length ?? 0) > 15);

        byKachel[tc.kachel] = byKachel[tc.kachel] || { ok: 0, fail: 0 };
        if (ok) {
            matchCount++;
            byKachel[tc.kachel].ok++;
            if (suggestedCmd && tc.phrase.length > 8 && !expectEmpty) {
                const instruction = 'Morgendrot. Eine ACTION pro Antwort.';
                const output = (thought ? thought + ' ' : '') + 'ACTION: ' + suggestedCmd;
                datasetAdditions.push(JSON.stringify({ instruction, input: tc.phrase, output }) + '\n');
            }
        } else {
            mismatchCount++;
            byKachel[tc.kachel].fail++;
            if (tc.expectCmd && tc.expectCmd !== '') {
                const correct = Array.isArray(tc.expectCmd) ? tc.expectCmd[0] : tc.expectCmd;
                corrections.push(tc.phrase + ' | ACTION: ' + correct);
            }
        }

        const outcome = {
            phrase: tc.phrase,
            expectCmd: tc.expectCmd,
            suggestedCmd,
            match: ok,
            kachel: tc.kachel,
            multiStep: tc.multiStep,
            ts: new Date().toISOString(),
        };
        appendFileSync(runPath, JSON.stringify(outcome) + '\n', 'utf8');
        appendFileSync(outcomesPath, JSON.stringify(outcome) + '\n', 'utf8');

        if ((i + 1) % 100 === 0) console.log('  …', i + 1, 'von', cases.length);
    }

    if (corrections.length > 0) {
        const existing = existsSync(correctionsPath) ? readFileSync(correctionsPath, 'utf8') : '';
        const header = existing.trim() ? '\n# 500-Kombinationen ' + new Date().toISOString() + '\n' : '';
        appendFileSync(correctionsPath, header + corrections.join('\n') + '\n', 'utf8');
        console.log('Corrections angehängt:', corrections.length, '→', correctionsPath);
    }
    if (datasetAdditions.length > 0) {
        const existing = existsSync(datasetAddPath) ? readFileSync(datasetAddPath, 'utf8') : '';
        const lines = existing.split(/\n/).filter(Boolean);
        const newLines = [...new Set(datasetAdditions.map((s) => s.trim()).filter(Boolean))];
        const combined = [...lines, ...newLines].slice(-400);
        writeFileSync(datasetAddPath, combined.join('\n') + (combined.length ? '\n' : ''), 'utf8');
        console.log('Dataset-Anreicherung:', newLines.length, 'neu →', datasetAddPath);
    }

    console.log('\n--- Ergebnis ---');
    console.log('Bestanden:', matchCount, '| Fehlgeschlagen:', mismatchCount, '| Gesamt:', cases.length);
    console.log('Quote:', cases.length ? ((matchCount / cases.length) * 100).toFixed(1) + '%' : '0%');
    console.log('\n--- Pro Kachel ---');
    for (const [k, v] of Object.entries(byKachel).sort()) {
        const total = v.ok + v.fail;
        console.log('  ' + k + ': ' + v.ok + '/' + total);
    }
    console.log('\nOutcomes:', outcomesPath, '+', runPath);

    if (!SKIP_RAG_BUILD) {
        console.log('\n--- Daten an KI: RAG neu bauen ---');
        const { execSync } = await import('child_process');
        try {
            execSync('npm run build:rag-chunks', { cwd: ROOT, stdio: 'inherit' });
            execSync('npm run build:rag-embeddings', { cwd: ROOT, stdio: 'inherit', timeout: 180000 });
            console.log('RAG-Chunks + Embeddings aktualisiert.');
        } catch (e) {
            console.warn('RAG-Build fehlgeschlagen (z. B. Ollama nicht bereit):', (e as Error).message?.slice(0, 80));
        }
    } else {
        console.log('\nRAG-Build übersprungen (SKIP_RAG_BUILD). Optional: npm run build:rag-chunks && npm run build:rag-embeddings');
    }

    process.exit(mismatchCount > cases.length / 2 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
