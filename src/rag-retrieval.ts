/**
 * RAG-Retrieval: Chunks laden, Frage embedden, Top-K + 1-Hop (Graph) zurückgeben.
 * Verwendet von ai-copilot.ts, wenn RAG aktiv und Embeddings vorhanden.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { CFG } from './config.js';

export type RagChunk = {
    id: string;
    text: string;
    source: string;
    file?: string;
    function?: string;
    references?: string[];
    embedding?: number[];
};

const DEFAULT_TOP_K = 3;
const DEFAULT_MAX_HOP_CHUNKS = 10;

let cachedChunks: RagChunk[] | null = null;
let cachedChunksPath: string | null = null;

function getChunksPath(): string {
    const base = process.cwd();
    return join(base, 'ai-training', 'rag-chunks.json');
}

/** Lädt Chunks aus rag-chunks.json (mit Cache). */
export function loadRagChunks(): RagChunk[] | null {
    const path = getChunksPath();
    if (cachedChunks !== null && cachedChunksPath === path) return cachedChunks;
    if (!existsSync(path)) return null;
    try {
        const raw = readFileSync(path, 'utf8');
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return null;
        const withEmbedding = arr.filter((c: RagChunk) => c.embedding && Array.isArray(c.embedding) && c.embedding.length > 0);
        if (withEmbedding.length === 0) return null;
        cachedChunks = withEmbedding;
        cachedChunksPath = path;
        return cachedChunks;
    } catch {
        return null;
    }
}

/** Kosinus-Similarität (Vektoren sollen gleiche Länge haben, z. B. L2-normiert). Exportiert für Unit-Tests. */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
}

const BM25_K1 = 1.2;

/** Einfache Tokenisierung: Kleinbuchstaben, Wörter aus Zeichenfolgen. */
function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .split(/[^a-z0-9äöüß]+/)
        .filter((t) => t.length > 0);
}

/** BM25-Score (Keyword-Turbo): query vs. chunk text. Höher = mehr Treffer. */
function bm25Score(
    queryTerms: string[],
    chunkTerms: Map<string, number>,
    docFreq: Map<string, number>,
    N: number,
): number {
    if (queryTerms.length === 0) return 0;
    let score = 0;
    for (const term of queryTerms) {
        const tf = chunkTerms.get(term) ?? 0;
        if (tf === 0) continue;
        const df = docFreq.get(term) ?? 0;
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
        score += idf * (tf * (BM25_K1 + 1)) / (tf + BM25_K1);
    }
    return score;
}

/** Normalisiert Werte in [0,1] (min-max). */
function normalizeScores(scores: number[]): number[] {
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;
    return scores.map((s) => (s - min) / range);
}

/** 1-Hop-Erweiterung: zu den Top-K-Chunks alle referenzierten Chunks hinzufügen (ohne Duplikate). Exportiert für Unit-Tests. */
export function expandWithReferences(
    chunkIds: string[],
    chunks: RagChunk[],
    idToChunk: Map<string, RagChunk>,
    maxExtra: number,
): string[] {
    const out = new Set(chunkIds);
    for (const id of chunkIds) {
        const c = idToChunk.get(id);
        if (!c?.references) continue;
        for (const refId of c.references) {
            if (idToChunk.has(refId)) out.add(refId);
            if (out.size >= chunkIds.length + maxExtra) break;
        }
        if (out.size >= chunkIds.length + maxExtra) break;
    }
    return [...out];
}

export type RagRetrieveOptions = {
    topK?: number;
    expandReferences?: boolean;
    maxHopChunks?: number;
};

/**
 * Sucht die relevantesten Chunks für die Frage (Top-K nach Kosinus-Similarität).
 * Optional: 1-Hop-Erweiterung – referenzierte Chunks (Graph) mit aufnehmen.
 */
export async function retrieveRelevantChunks(
    query: string,
    options?: RagRetrieveOptions,
): Promise<{ chunks: RagChunk[]; text: string } | null> {
    const chunks = loadRagChunks();
    if (!chunks || chunks.length === 0) return null;

    const ollamaUrl = CFG.OLLAMA_URL || 'http://127.0.0.1:11434';
    const embedModel = CFG.RAG_EMBEDDING_MODEL || 'nomic-embed-text';
    const url = `${String(ollamaUrl).replace(/\/$/, '')}/api/embed`;

    let queryEmbedding: number[];
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: embedModel, input: query.slice(0, 8000) }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { embeddings?: number[][] };
        const emb = data.embeddings;
        if (!Array.isArray(emb) || emb.length === 0 || !Array.isArray(emb[0])) return null;
        queryEmbedding = emb[0];
    } catch {
        return null;
    }

    // Token-Hygiene: Top-K (Default 3) ≈ ~1.5k Tokens. Optional: mehr abrufen (RAG_TOP_K_RETRIEVE), nur topK ins Prompt.
    const topK = options?.topK ?? CFG.RAG_TOP_K ?? DEFAULT_TOP_K;
    const retrieveK = (CFG.RAG_TOP_K_RETRIEVE && CFG.RAG_TOP_K_RETRIEVE > topK) ? CFG.RAG_TOP_K_RETRIEVE : topK;
    const expand = options?.expandReferences ?? CFG.RAG_EXPAND_REFERENCES;
    const maxHop = options?.maxHopChunks ?? DEFAULT_MAX_HOP_CHUNKS;

    const CORRECTIONS_BOOST = 1.35;
    const PROJECT_LOGIC_BOOST = 1.15;

    // Hybrid: BM25 (Keyword) + Vektor (Embedding). Score-Fusion 0.4 * BM25 + 0.6 * Cosine.
    const queryTerms = [...new Set(tokenize(query))];
    const chunkTermMaps = chunks.map((c) => {
        const terms = tokenize(c.text);
        const m = new Map<string, number>();
        for (const t of terms) m.set(t, (m.get(t) ?? 0) + 1);
        return m;
    });
    const docFreq = new Map<string, number>();
    for (const m of chunkTermMaps) {
        for (const t of m.keys()) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    }
    const N = chunks.length;
    const bm25Scores = chunks.map((c, i) =>
        bm25Score(queryTerms, chunkTermMaps[i], docFreq, N),
    );
    const bm25Norm = normalizeScores(bm25Scores);

    const cosineScores = chunks.map((c) => cosineSimilarity(queryEmbedding, c.embedding!));
    const cosineNorm = normalizeScores(cosineScores.map((s) => Math.max(0, s)));

    const scored = chunks.map((c, i) => {
        let combined = 0.4 * bm25Norm[i] + 0.6 * cosineNorm[i];
        if (c.source === 'corrections') combined *= CORRECTIONS_BOOST;
        if (c.source === 'project_logic') combined *= PROJECT_LOGIC_BOOST;
        return { chunk: c, score: combined };
    });
    scored.sort((a, b) => b.score - a.score);

    const MIN_SCORE = CFG.RAG_MIN_SCORE ?? 0.3;
    const aboveThreshold = scored.filter((s) => s.score >= MIN_SCORE);
    if (aboveThreshold.length === 0) return { chunks: [], text: '' };

    let topIds = aboveThreshold.slice(0, retrieveK).map((s) => s.chunk.id);

    const idToChunk = new Map(chunks.map((c) => [c.id, c]));
    if (expand) topIds = expandWithReferences(topIds, chunks, idToChunk, maxHop);
    topIds = topIds.slice(0, topK);

    const resultChunks = topIds.map((id) => idToChunk.get(id)).filter(Boolean) as RagChunk[];
    const text = resultChunks.map((c) => `[${c.source}] ${c.text}`).join('\n\n---\n\n');
    return { chunks: resultChunks, text };
}

/** Prüft, ob RAG nutzbar ist (Chunks mit Embeddings vorhanden). */
export function isRagAvailable(): boolean {
    return loadRagChunks() !== null;
}
