/**
 * Übernimmt bestätigte Aktionen (confirmed-actions.jsonl) ins Dataset und baut RAG neu.
 * Optional: nur merge (ohne RAG), nur RAG (ohne merge).
 *
 * Aufruf: npx tsx scripts/merge-feedback-and-rebuild-rag.ts
 *         MERGE_ONLY=1  → nur in Dataset übernehmen, RAG nicht bauen
 *         RAG_ONLY=1    → nur RAG bauen (ohne confirmed-actions einlesen)
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AI = join(ROOT, 'ai-training');

const MERGE_ONLY = process.env.MERGE_ONLY === '1' || process.env.MERGE_ONLY === 'true';
const RAG_ONLY = process.env.RAG_ONLY === '1' || process.env.RAG_ONLY === 'true';

function main() {
  if (!RAG_ONLY) {
    const confirmedPath = join(AI, 'confirmed-actions.jsonl');
    const additionsPath = join(AI, 'realworld-dataset-additions.jsonl');
    const datasetPath = join(AI, 'morgendrot-dataset.jsonl');

    if (!existsSync(confirmedPath)) {
      console.log('Keine confirmed-actions.jsonl – nichts zu übernehmen.');
    } else {
      const raw = readFileSync(confirmedPath, 'utf8');
      const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        console.log('confirmed-actions.jsonl ist leer.');
      } else {
        const instruction = 'Morgendrot. Eine ACTION pro Antwort.';
        const newLines: string[] = [];
        for (const line of lines) {
          try {
            const o = JSON.parse(line) as { input?: string; output?: string };
            const input = (o.input || '').trim();
            const output = (o.output || '').trim();
            if (input && output) newLines.push(JSON.stringify({ instruction, input, output }));
          } catch {
            // skip
          }
        }
        if (newLines.length > 0) {
          const existing = existsSync(additionsPath) ? readFileSync(additionsPath, 'utf8') : '';
          const combined = existing.trim() ? existing.trim().split(/\n/).concat(newLines) : newLines;
          const dedup = [...new Set(combined)];
          writeFileSync(additionsPath, dedup.join('\n') + '\n', 'utf8');
          appendFileSync(datasetPath, '\n' + newLines.join('\n') + '\n', 'utf8');
          console.log('Übernommen:', newLines.length, '→', additionsPath, '+', datasetPath);
        }
      }
    }
  }

  if (!MERGE_ONLY) {
    console.log('RAG neu bauen …');
    try {
      execSync('npm run build:rag-chunks', { cwd: ROOT, stdio: 'inherit' });
      execSync('npm run build:rag-embeddings', { cwd: ROOT, stdio: 'inherit', timeout: 180000 });
      console.log('RAG-Chunks + Embeddings aktualisiert.');
    } catch (e: unknown) {
      console.warn('RAG-Build fehlgeschlagen:', (e as Error)?.message?.slice(0, 80));
      process.exit(1);
    }
  }
}

main();
