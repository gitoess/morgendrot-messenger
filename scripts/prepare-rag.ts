/**
 * RAG vollständig vorbereiten: Chunks bauen + Embeddings (wenn Ollama erreichbar).
 * Wird von "npm run dev" automatisch ausgeführt. Bei fehlendem Ollama: App startet trotzdem, RAG läuft ohne Embeddings.
 *
 * Manuell: npm run prepare:rag
 * Einzelschritte (optional): npm run build:rag-chunks | npm run build:rag-embeddings
 */
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function run(cmd: string): boolean {
    const r = spawnSync(cmd, [], {
        cwd: root,
        stdio: 'inherit',
        shell: true,
    });
    return r.status === 0;
}

function main() {
    console.log('RAG: Chunks bauen…');
    if (!run('npm run build:rag-chunks')) {
        console.error('prepare-rag: Chunk-Build fehlgeschlagen.');
        process.exit(1);
    }

    console.log('RAG: Embeddings (falls Ollama läuft)…');
    const embedOk = run('npm run build:rag-embeddings');
    if (!embedOk) {
        console.log('');
        console.log('(Ollama nicht erreichbar oder Modell fehlt – RAG läuft ohne Embeddings.');
        console.log('  Optional: ollama run nomic-embed-text && npm run build:rag-embeddings)');
    }

    process.exit(0);
}

main();
