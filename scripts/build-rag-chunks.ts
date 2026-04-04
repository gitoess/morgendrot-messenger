/**
 * Erzeugt RAG-Chunks aus APPLICATION_KNOWLEDGE, tools-schema, corrections, code-structure, execution-traces.
 * Ausgabe: ai-training/rag-chunks.json (id, text, source, file?, function?, references?).
 * Embeddings werden hier nicht berechnet.
 *
 * Nutzung: npx tsx scripts/build-rag-chunks.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { APPLICATION_KNOWLEDGE } from '../src/ai-copilot-context.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outPath = join(root, 'ai-training', 'rag-chunks.json');

export type Chunk = {
    id: string;
    text: string;
    source: string;
    file?: string;
    function?: string;
    references?: string[];
};

function chunkBySections(content: string, source: string, refMap?: Map<number, string[]>): Chunk[] {
    const chunks: Chunk[] = [];
    const sections = content.split(/\n---\s*/).filter((s) => s.trim().length > 0);
    sections.forEach((section, i) => {
        const text = section.trim();
        if (text.length < 50) return;
        const refs = refMap?.get(i + 1);
        chunks.push({
            id: `${source}-${i + 1}`,
            text,
            source,
            ...(refs?.length ? { references: refs } : {}),
        });
    });
    return chunks;
}

function chunkByLines(content: string, source: string, lineChunkSize = 25): Chunk[] {
    const chunks: Chunk[] = [];
    const lines = content.split(/\n/).filter((l) => l.trim());
    for (let i = 0; i < lines.length; i += lineChunkSize) {
        const block = lines.slice(i, i + lineChunkSize).join('\n').trim();
        if (block.length < 30) continue;
        chunks.push({
            id: `${source}-line-${i + 1}`,
            text: block,
            source,
        });
    }
    return chunks;
}

/** Erzeugt Code-Struktur-Chunks (Deep Code Indexing): Datei + Funktionen für zentralen Code. */
function buildCodeStructureChunks(): Chunk[] {
    const chunks: Chunk[] = [];
    const files: { rel: string; desc: string; refs: string[] }[] = [
        { rel: 'src/wallet-bridge.ts', desc: 'Befehlslogik: /handshake, /connect, /send, /create-key, /vault-save, …', refs: ['api-server', 'chain-access'] },
        { rel: 'src/chain-access.ts', desc: 'IOTA Rebased: Move, queryEvents, Handshake/Mailbox, signAndExecute', refs: ['config'] },
        { rel: 'src/api-server.ts', desc: 'REST für UI: /api/command, /api/ai-copilot, /api/status', refs: ['wallet-bridge'] },
        { rel: 'src/ai-copilot.ts', desc: 'AI: buildSystemPrompt, askAiCopilot, Intent + Ollama', refs: ['ai-copilot-context', 'wallet-bridge'] },
        { rel: 'src/ai-intent-matcher.ts', desc: 'Intent-Matcher: Befehle aus natürlicher Sprache ohne Ollama', refs: ['wallet-bridge'] },
        { rel: 'src/gas-station.ts', desc: 'runGasStationCheck: Boss prüft WORKER_ADDRESSES, GAS_STATION_MIN_IOTA nachfüllen', refs: ['wallet-bridge', 'chain-access'] },
    ];
    for (const f of files) {
        const fullPath = join(root, f.rel);
        if (!existsSync(fullPath)) continue;
        let funcs: string[] = [];
        try {
            const raw = readFileSync(fullPath, 'utf8');
            const fnMatch = raw.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/g);
            for (const m of fnMatch) {
                const name = (m[1] || m[2] || '').trim();
                if (name) funcs.push(name);
            }
            funcs = [...new Set(funcs)].slice(0, 25);
        } catch {
            // ignore
        }
        const text = f.desc + (funcs.length ? '\nFunktionen: ' + funcs.join(', ') : '');
        chunks.push({
            id: `code-${f.rel.replace(/\//g, '-').replace(/\.ts$/, '')}`,
            text,
            source: 'code_structure',
            file: f.rel,
            ...(funcs.length ? { function: funcs[0] } : {}),
            references: f.refs.map((r) => `code-src-${r.replace(/\//g, '-')}`),
        });
    }
    return chunks;
}

function main() {
    const all: Chunk[] = [];
    const appChunks = chunkBySections(APPLICATION_KNOWLEDGE, 'application_knowledge');
    all.push(...appChunks);
    all.push(...buildCodeStructureChunks());

    const toolsPath = join(root, 'ai-training', 'tools-schema.md');
    try {
        const toolsMd = readFileSync(toolsPath, 'utf8');
        const toolsChunks = chunkBySections(toolsMd, 'tools_schema');
        if (toolsChunks.length === 0) all.push(...chunkByLines(toolsMd, 'tools_schema', 30));
        else all.push(...toolsChunks);
    } catch {
        // optional
    }

    // Korrekturen (Feedback-Schleife): ai-training/corrections.txt – eine Zeile pro Korrektur (Frage | richtige Antwort)
    const correctionsPath = join(root, 'ai-training', 'corrections.txt');
    try {
        const correctionsRaw = readFileSync(correctionsPath, 'utf8');
        const lines = correctionsRaw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
        lines.forEach((line, i) => {
            const parts = line.split(/\s*\|\s*/);
            const text = parts.length >= 2 ? `${parts[0].trim()} → ${parts.slice(1).join(' | ').trim()}` : line;
            if (text.length < 10) return;
            all.push({ id: `corrections-${i + 1}`, text, source: 'corrections' });
        });
    } catch {
        // optional: Datei darf fehlen
    }

    // README.md (Projekt-Übersicht, Befehle, Doku-Links) – erste Abschnitte als Chunks
    const readmePath = join(root, 'README.md');
    try {
        const readmeMd = readFileSync(readmePath, 'utf8');
        const readmeSections = readmeMd.split(/\n##\s+/).filter((s) => s.trim().length > 80);
        readmeSections.slice(0, 12).forEach((section, i) => {
            const text = section.trim().slice(0, 4000);
            if (text.length < 100) return;
            all.push({
                id: `readme-${i + 1}`,
                text: 'README: ' + text,
                source: 'readme',
            });
        });
    } catch {
        // optional
    }

    // Projekt-Logik (4 Säulen, Wenn-Dann, Befehls-Mapping) – Kausalitäts-Matrix für KI
    const projectLogicPath = join(root, 'ai-training', 'PROJECT_LOGIC.md');
    try {
        const projectLogicMd = readFileSync(projectLogicPath, 'utf8');
        const projectLogicSections = projectLogicMd.split(/\n##\s+/).filter((s) => s.trim().length > 60);
        projectLogicSections.forEach((section, i) => {
            const text = section.trim().slice(0, 4000);
            if (text.length < 80) return;
            all.push({
                id: `project_logic-${i + 1}`,
                text: 'PROJECT_LOGIC: ' + text,
                source: 'project_logic',
            });
        });
    } catch {
        // optional
    }

    // Weitere Docs (Config, .env, Schloss) – RAG kann bei Fragen gezielt passende Abschnitte liefern
    const docFiles = [
        { name: 'ENV-ERKLAERUNG', path: 'docs/ENV-ERKLAERUNG.md' },
        { name: 'CONFIG-REFERENCE', path: 'docs/CONFIG-REFERENCE.md' },
        { name: 'SCHLOSS-EINRICHTEN', path: 'docs/SCHLOSS-EINRICHTEN.md' },
        { name: 'VAULT-EINRICHTEN', path: 'docs/VAULT-EINRICHTEN.md' },
        { name: 'FAMILIEN-ZUGANG', path: 'docs/FAMILIEN-ZUGANG.md' },
    ];
    for (const doc of docFiles) {
        const fullPath = join(root, doc.path);
        if (!existsSync(fullPath)) continue;
        try {
            const md = readFileSync(fullPath, 'utf8');
            const sections = md.split(/\n##\s+/).filter((s) => s.trim().length > 60);
            sections.slice(0, 10).forEach((section, i) => {
                const text = section.trim().slice(0, 3500);
                if (text.length < 80) return;
                all.push({
                    id: `docs-${doc.name}-${i + 1}`,
                    text: doc.name + ': ' + text,
                    source: 'docs',
                });
            });
        } catch {
            // optional
        }
    }

    // Intent-Tabelle (Synonyme → Befehl): ai-training/intents.json – für KI/RAG
    const intentsPath = join(root, 'ai-training', 'intents.json');
    try {
        const intentsRaw = readFileSync(intentsPath, 'utf8');
        const intents = JSON.parse(intentsRaw) as { description?: string; groups?: Array<{ id: string; label: string; commands: string[]; triggers: string[] }> };
        const intentText =
            (intents.description || 'Intent-Mapping') +
            '\n' +
            (intents.groups || [])
                .map(
                    (g) =>
                        `${g.label} (${g.id}): ${g.commands.join(', ')} ← Trigger: ${g.triggers.slice(0, 8).join(', ')}`,
                )
                .join('\n');
        if (intentText.length > 80) {
            all.push({
                id: 'intents-1',
                text: 'INTENTS: ' + intentText,
                source: 'intents',
            });
        }
    } catch {
        // optional
    }

    // Logik-Baum (Mermaid): ai-training/logic-tree.mmd – IF-THEN-EXECUTE-SUGGEST, Säulen
    const logicTreePath = join(root, 'ai-training', 'logic-tree.mmd');
    try {
        const logicTreeRaw = readFileSync(logicTreePath, 'utf8');
        const logicTreeText = logicTreeRaw.replace(/%%[^\n]*/g, '').trim();
        if (logicTreeText.length > 100) {
            all.push({
                id: 'logic_tree-1',
                text: 'LOGIC_TREE (Mermaid): ' + logicTreeText.slice(0, 3000),
                source: 'logic_tree',
            });
        }
    } catch {
        // optional
    }

    // Drill-Beispiele: ai-training/drill-examples.txt – User → KI-Antwort für Few-Shot/RAG
    const drillPath = join(root, 'ai-training', 'drill-examples.txt');
    try {
        const drillRaw = readFileSync(drillPath, 'utf8');
        const drillLines = drillRaw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
        const drillBlock = drillLines
            .filter((l) => l.includes('|'))
            .map((l) => {
                const [user, answer] = l.split(/\s*\|\s*/);
                return (user && answer ? `${user} → ${answer}` : l).slice(0, 400);
            })
            .join('\n');
        if (drillBlock.length > 100) {
            all.push({
                id: 'drill_examples-1',
                text: 'DRILL_EXAMPLES (User → Antwort):\n' + drillBlock.slice(0, 6000),
                source: 'drill_examples',
            });
        }
    } catch {
        // optional
    }

    // Sicherheits-Checkliste: ai-training/security-checklist.md
    const securityChecklistPath = join(root, 'ai-training', 'security-checklist.md');
    try {
        const securityMd = readFileSync(securityChecklistPath, 'utf8');
        const securitySections = securityMd.split(/\n##\s+/).filter((s) => s.trim().length > 40);
        securitySections.forEach((section, i) => {
            const text = section.trim().slice(0, 2500);
            if (text.length > 50) {
                all.push({
                    id: `security_checklist-${i + 1}`,
                    text: 'SECURITY_CHECKLIST: ' + text,
                    source: 'security_checklist',
                });
            }
        });
        if (securitySections.length === 0 && securityMd.trim().length > 80) {
            all.push({
                id: 'security_checklist-1',
                text: 'SECURITY_CHECKLIST: ' + securityMd.trim().slice(0, 3000),
                source: 'security_checklist',
            });
        }
    } catch {
        // optional
    }

    // Execution-Trace (echte Transaktionen): ai-training/execution-traces.jsonl – eine JSON-Zeile pro TX
    const tracesPath = join(root, 'ai-training', 'execution-traces.jsonl');
    try {
        const tracesRaw = readFileSync(tracesPath, 'utf8');
        const traceLines = tracesRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        traceLines.forEach((line, i) => {
            try {
                const o = JSON.parse(line) as { txId?: string; summary?: string; outcome?: string; command?: string };
                const summary = o.summary || o.command || o.txId || line;
                if (String(summary).length < 5) return;
                const text =
                    (o.txId ? `TX: ${o.txId}. ` : '') +
                    summary +
                    (o.outcome ? ` → ${o.outcome}` : '');
                all.push({
                    id: `execution_trace-${i + 1}`,
                    text,
                    source: 'execution_trace',
                });
            } catch {
                // skip invalid line
            }
        });
    } catch {
        // optional
    }

    // Logic-Traces (100 Pfade): [Bedingung] → [Aktion] → [Ergebnis] – Kausalität für die KI, kein Gas
    const logicTracesPath = join(root, 'ai-training', 'logic-traces.jsonl');
    try {
        if (existsSync(logicTracesPath)) {
            const lines = readFileSync(logicTracesPath, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            lines.forEach((line, i) => {
                try {
                    const o = JSON.parse(line) as { summary?: string; outcome?: string; command?: string };
                    const summary = o.summary || o.command || '';
                    if (summary.length < 10) return;
                    all.push({
                        id: `logic_trace-${i + 1}`,
                        text: (o.outcome ? `[${o.outcome}] ` : '') + summary,
                        source: 'logic_trace',
                    });
                } catch {
                    // skip
                }
            });
        }
    } catch {
        // optional
    }

    // Real-World-Outcomes (test:realworld-1000): Phrase → Befehl (Match-Fälle) als RAG-Kontext für die KI
    const outcomesPath = join(root, 'ai-training', 'real-world-outcomes.jsonl');
    try {
        if (existsSync(outcomesPath)) {
            const lines = readFileSync(outcomesPath, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            const matches = lines
                .map((line) => {
                    try {
                        const o = JSON.parse(line) as { phrase?: string; suggestedCmd?: string; suggestedArgs?: string[]; match?: boolean };
                        return o.match && o.suggestedCmd && o.phrase ? { phrase: o.phrase, cmd: o.suggestedCmd, args: (o.suggestedArgs || []).join(' ') } : null;
                    } catch {
                        return null;
                    }
                })
                .filter((x): x is { phrase: string; cmd: string; args: string } => x !== null);
            const batchSize = 50;
            for (let i = 0; i < matches.length; i += batchSize) {
                const batch = matches.slice(i, i + batchSize);
                const text = 'REAL_WORLD (Phrase → Befehl): ' + batch.map((m) => `"${m.phrase.slice(0, 60)}…" → ${m.cmd} ${m.args}`.trim()).join('; ');
                if (text.length > 100) {
                    all.push({
                        id: `real_world-${i / batchSize + 1}`,
                        text: text.slice(0, 4000),
                        source: 'real_world',
                    });
                }
            }
        }
    } catch {
        // optional
    }

    // Codebase (repomix-Output): codebase.md im Projektroot oder ai-training/codebase.md – gesamtes Repo als Kontext für KI
    const codebasePaths = [join(root, 'codebase.md'), join(root, 'ai-training', 'codebase.md')];
    for (const codebasePath of codebasePaths) {
        if (!existsSync(codebasePath)) continue;
        try {
            const codebaseMd = readFileSync(codebasePath, 'utf8');
            const codebaseSections = codebaseMd.split(/\n##\s+|\n#\s+/).filter((s) => s.trim().length > 100);
            if (codebaseSections.length > 0) {
                codebaseSections.slice(0, 40).forEach((section, i) => {
                    const text = section.trim().slice(0, 3500);
                    if (text.length < 80) return;
                    all.push({
                        id: `codebase-${i + 1}`,
                        text: 'CODEBASE: ' + text,
                        source: 'codebase',
                    });
                });
            } else {
                const lineChunks = chunkByLines(codebaseMd, 'codebase', 40);
                all.push(...lineChunks.slice(0, 30));
            }
            break;
        } catch {
            // optional
        }
    }

    writeFileSync(outPath, JSON.stringify(all, null, 2), 'utf8');
    console.log('RAG-Chunks geschrieben:', outPath);
    console.log('Anzahl Chunks:', all.length);
    console.log('Nächster Schritt: Embeddings pro Chunk (Ollama/API) und in Chunks speichern – siehe ai-training/RAG-SETUP.md');
    process.exit(0);
}

main();
