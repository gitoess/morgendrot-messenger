/**
 * Test: 50 Szenarien aus ai-training/morgendrot-dataset.jsonl gegen den AI-Copilot.
 * - Liest JSONL (instruction, input, output).
 * - Erwartete ACTION: /cmd aus output extrahieren, mit suggestedAction oder geparster Antwort vergleichen.
 * - Ohne Ollama: nur Intent-Matcher + Direktbefehle (schnell). Mit Ollama: volle Simulation (OLLAMA_URL gesetzt).
 *
 * Nutzung: npx tsx scripts/run-ai-dataset-scenarios.ts
 *          ENABLE_AI_INTENT_MATCHER=true OLLAMA_URL=http://localhost:11434 npx tsx scripts/run-ai-dataset-scenarios.ts
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { askAiCopilot } from '../src/ai-copilot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const datasetPath = join(root, 'ai-training', 'morgendrot-dataset.jsonl');

type Scenario = { instruction: string; input: string; output: string };

function loadScenarios(): Scenario[] {
    const raw = readFileSync(datasetPath, 'utf8');
    const lines = raw.split(/\n/).filter((l) => l.trim());
    return lines.map((line) => {
        const o = JSON.parse(line) as Scenario;
        return { instruction: o.instruction || '', input: o.input || '', output: o.output || '' };
    });
}

/** Extrahiert erwarteten Befehl aus "ACTION: /cmd ..." im output. */
function expectedCmdFromOutput(output: string): string | null {
    const m = output.match(/ACTION:\s*(\/[a-z0-9-]+)/i);
    return m ? m[1].toLowerCase() : null;
}

/** Extrahiert cmd aus KI-Antwort (suggestedAction oder ACTION-Zeile im Text). */
function getActualCmd(result: { suggestedAction?: { cmd: string }; text?: string }): string | null {
    if (result.suggestedAction?.cmd) return result.suggestedAction.cmd.toLowerCase();
    const text = result.text || '';
    const m = text.match(/ACTION:\s*(\/[a-z0-9-]+)/i);
    return m ? m[1].toLowerCase() : null;
}

/** Weiche Übereinstimmung: create-key vs create-key-and-notify wenn erwartet create-key. */
function cmdMatches(expected: string, actual: string | null): boolean {
    if (!actual) return false;
    if (expected === actual) return true;
    if (expected === '/create-key' && (actual === '/create-key-and-notify' || actual === '/create-keys')) return true;
    return false;
}

async function main() {
    const useOllama = !!process.env.OLLAMA_URL?.trim();
    const scenarios = loadScenarios();
    console.log('Dataset:', datasetPath);
    console.log('Szenarien:', scenarios.length);
    console.log('Ollama:', useOllama ? process.env.OLLAMA_URL : 'aus (nur Intent/Direkt)');
    console.log('');

    let passed = 0;
    let failed = 0;
    const failures: { input: string; expected: string | null; actual: string | null; error?: string }[] = [];

    for (let i = 0; i < scenarios.length; i++) {
        const { input, output } = scenarios[i];
        const expectedCmd = expectedCmdFromOutput(output);
        const r = await askAiCopilot(input, undefined, {
            useIntentMatcher: true,
            useOllama: useOllama,
        });
        const actualCmd = getActualCmd(r);

        const ok =
            expectedCmd === null
                ? r.ok
                : r.ok && actualCmd !== null && cmdMatches(expectedCmd, actualCmd);

        if (ok) {
            passed++;
            process.stdout.write('.');
        } else {
            failed++;
            failures.push({
                input: input.slice(0, 60) + (input.length > 60 ? '…' : ''),
                expected: expectedCmd,
                actual: actualCmd,
                error: r.ok ? undefined : (r as { error?: string }).error,
            });
            process.stdout.write('F');
        }
    }

    console.log('\n');
    console.log('--- Ergebnis ---');
    console.log('Bestanden:', passed, 'Fehlgeschlagen:', failed);

    if (failures.length > 0) {
        console.log('\nFehlgeschlagen (max 15):');
        failures.slice(0, 15).forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.input}`);
            console.log(`     Erwartet: ${f.expected}  Got: ${f.actual || f.error || '—'}`);
        });
    }

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
