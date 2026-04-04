/**
 * Berechnet Embeddings für alle Chunks in ai-training/rag-chunks.json (Ollama /api/embed).
 * Überschreibt nur Chunks ohne vorhandenes embedding. Schreibt die Datei danach zurück.
 *
 * Voraussetzung: Ollama läuft, Embedding-Modell geladen (z. B. ollama run nomic-embed-text).
 * Nutzung: npm run build:rag-embeddings
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const chunksPath = join(root, 'ai-training', 'rag-chunks.json');

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').trim().replace(/\/$/, '');
const EMBED_MODEL = process.env.RAG_EMBEDDING_MODEL || process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

type ChunkWithEmbedding = {
    id: string;
    text: string;
    source: string;
    file?: string;
    function?: string;
    references?: string[];
    embedding?: number[];
};

async function embedOne(text: string): Promise<number[]> {
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Ollama embed: ${res.status} ${t.slice(0, 200)}`);
    }
    const data = (await res.json()) as { embeddings?: number[][] };
    const emb = data.embeddings;
    if (Array.isArray(emb) && emb.length > 0 && Array.isArray(emb[0])) return emb[0];
    throw new Error('Ollama embed: keine embeddings in Antwort');
}

async function main() {
    if (!existsSync(chunksPath)) {
        console.error('Nicht gefunden:', chunksPath, '– zuerst npm run build:rag-chunks ausführen.');
        process.exit(1);
    }
    const raw = readFileSync(chunksPath, 'utf8');
    const chunks = JSON.parse(raw) as ChunkWithEmbedding[];
    if (!Array.isArray(chunks)) {
        console.error('Ungültiges Format: erwarte Array von Chunks.');
        process.exit(1);
    }

    const toFill = chunks.filter((c) => !c.embedding || c.embedding.length === 0);
    if (toFill.length === 0) {
        console.log('Alle Chunks haben bereits Embeddings. Fertig.');
        process.exit(0);
    }

    console.log('Embedding-Modell:', EMBED_MODEL, '| Chunks ohne Embedding:', toFill.length);
    let filled = 0;
    for (let i = 0; i < toFill.length; i++) {
        const c = toFill[i];
        try {
            c.embedding = await embedOne(c.text);
            filled++;
            process.stdout.write(`  ${i + 1}/${toFill.length} ${c.id}\r`);
        } catch (e: any) {
            const msg = e?.message || String(e);
            console.error('\nOllama nicht erreichbar oder Modell fehlt:', msg.slice(0, 120));
            console.log('RAG läuft ohne Embeddings. Optional: ollama run ' + EMBED_MODEL + ' und erneut ausführen.');
            process.exit(0);
        }
    }
    if (filled > 0) {
        console.log('\nSchreibe', chunksPath, '…');
        writeFileSync(chunksPath, JSON.stringify(chunks, null, 2), 'utf8');
        console.log('Fertig. Embeddings in', chunks.length, 'Chunks.');
    }
    process.exit(0);
}

main();
