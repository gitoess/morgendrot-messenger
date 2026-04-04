/**
 * Unit-Tests für RAG-Retrieval: cosineSimilarity, expandWithReferences, loadRagChunks, retrieveRelevantChunks.
 * Läuft ohne Ollama (Embedding per Mock). Ausführung: npx tsx scripts/run-rag-retrieval-test.ts
 */
import { strict as assert } from 'node:assert';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { cosineSimilarity, expandWithReferences, loadRagChunks, retrieveRelevantChunks, type RagChunk } from '../src/rag-retrieval.js';
import { isRagAvailable } from '../src/rag-retrieval.js';

let passed = 0;
let failed = 0;

function ok(name: string) {
    passed++;
    console.log('  ✓ ' + name);
}
function fail(name: string, err: unknown) {
    failed++;
    console.log('  ✗ ' + name + ': ' + (err instanceof Error ? err.message : String(err)));
}

// --- cosineSimilarity ---
function testCosineSimilarity() {
    console.log('\n--- cosineSimilarity ---');
    try {
        assert.strictEqual(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1, 'gleicher Vektor = 1');
        assert.strictEqual(cosineSimilarity([0, 1, 0], [0, 1, 0]), 1, 'gleicher Vektor (2) = 1');
        assert.strictEqual(cosineSimilarity([1, 0, 0], [0, 1, 0]), 0, 'orthogonal = 0');
        assert.strictEqual(cosineSimilarity([1, 0, 0], [0, 0, 1]), 0, 'orthogonal (2) = 0');
        const a = [1 / Math.sqrt(2), 1 / Math.sqrt(2), 0];
        const b = [1, 0, 0];
        const cos = cosineSimilarity(a, b);
        assert.ok(cos > 0.7 && cos < 0.72, '45° ≈ 0.707: ' + cos);
        assert.strictEqual(cosineSimilarity([], []), 0, 'leer = 0');
        assert.strictEqual(cosineSimilarity([1, 2], [1, 2, 3]), 0, 'unterschiedliche Länge = 0');
        ok('cosineSimilarity');
    } catch (e) {
        fail('cosineSimilarity', e);
    }
}

// --- expandWithReferences ---
function testExpandWithReferences() {
    console.log('\n--- expandWithReferences ---');
    try {
        const chunks: RagChunk[] = [
            { id: 'a', text: 'A', source: 'x', references: ['b'] },
            { id: 'b', text: 'B', source: 'x', references: ['c'] },
            { id: 'c', text: 'C', source: 'x' },
        ];
        const idToChunk = new Map(chunks.map((c) => [c.id, c]));
        const out1 = expandWithReferences(['a'], chunks, idToChunk, 5);
        assert.deepStrictEqual(out1.sort(), ['a', 'b'], 'A -> A,B');
        const out2 = expandWithReferences(['a', 'b'], chunks, idToChunk, 5);
        assert.ok(out2.includes('a') && out2.includes('b') && out2.includes('c'), 'A,B -> A,B,C');
        const out3 = expandWithReferences(['x'], chunks, idToChunk, 5);
        assert.deepStrictEqual(out3, ['x'], 'unbekannte ID bleibt');
        ok('expandWithReferences');
    } catch (e) {
        fail('expandWithReferences', e);
    }
}

// --- loadRagChunks mit Fixture ---
function testLoadRagChunks() {
    console.log('\n--- loadRagChunks (Fixture) ---');
    const cwd = process.cwd();
    const dir = path.join(tmpdir(), 'morgendrot-rag-test-' + Date.now());
    const aiDir = path.join(dir, 'ai-training');
    const chunksPath = path.join(aiDir, 'rag-chunks.json');
    try {
        fs.mkdirSync(aiDir, { recursive: true });
        const fixture: RagChunk[] = [
            { id: 'f1', text: 'Chunk one', source: 'test', embedding: [1, 0, 0] },
            { id: 'f2', text: 'Chunk two', source: 'test', embedding: [0, 1, 0] },
        ];
        fs.writeFileSync(chunksPath, JSON.stringify(fixture), 'utf8');
        process.chdir(dir);
        const loaded = loadRagChunks();
        assert.ok(Array.isArray(loaded) && loaded.length === 2, '2 Chunks geladen');
        assert.strictEqual(loaded![0].id, 'f1');
        assert.strictEqual(loaded![1].id, 'f2');
        assert.ok(isRagAvailable(), 'isRagAvailable true mit Fixture');
        ok('loadRagChunks mit Fixture');
    } catch (e) {
        fail('loadRagChunks', e);
    } finally {
        process.chdir(cwd);
        try {
            fs.unlinkSync(chunksPath);
            fs.rmdirSync(aiDir);
            fs.rmdirSync(dir);
        } catch {}
    }
}

// --- retrieveRelevantChunks mit Mock-Fetch ---
async function testRetrieveRelevantChunks() {
    console.log('\n--- retrieveRelevantChunks (Mock Embedding) ---');
    const cwd = process.cwd();
    const dir = path.join(tmpdir(), 'morgendrot-rag-retrieve-' + Date.now());
    const aiDir = path.join(dir, 'ai-training');
    const chunksPath = path.join(aiDir, 'rag-chunks.json');
    const origFetch = globalThis.fetch;
    try {
        fs.mkdirSync(aiDir, { recursive: true });
        const fixture: RagChunk[] = [
            { id: 'r1', text: 'Handshake ECDH', source: 'test', embedding: [1, 0, 0] },
            { id: 'r2', text: 'Vault speichern', source: 'test', embedding: [0, 1, 0] },
            { id: 'r3', text: 'Purge Rebate', source: 'test', embedding: [0, 0, 1] },
        ];
        fs.writeFileSync(chunksPath, JSON.stringify(fixture), 'utf8');
        process.chdir(dir);
        // Query-Embedding = [1,0,0] -> r1 soll höchste Similarity haben
        globalThis.fetch = async (url: string | URL) => {
            const u = typeof url === 'string' ? url : url.toString();
            if (u.includes('/api/embed')) {
                return { ok: true, json: async () => ({ embeddings: [[1, 0, 0]] }) } as Response;
            }
            return origFetch(url);
        };
        const result = await retrieveRelevantChunks('handshake', { topK: 2, expandReferences: false });
        assert.ok(result !== null && result.chunks.length >= 1, 'Ergebnis nicht leer');
        assert.strictEqual(result!.chunks[0].id, 'r1', 'höchste Similarity = r1 (Handshake)');
        assert.ok(result!.text.includes('Handshake') || result!.text.includes('r1'), 'Text enthält Top-Chunk');
        ok('retrieveRelevantChunks mit Mock');
    } catch (e) {
        fail('retrieveRelevantChunks', e);
    } finally {
        globalThis.fetch = origFetch;
        process.chdir(cwd);
        try {
            fs.unlinkSync(chunksPath);
            fs.rmdirSync(aiDir);
            fs.rmdirSync(dir);
        } catch {}
    }
}

async function main() {
    console.log('Morgendrot – RAG-Retrieval Unit-Tests');
    testCosineSimilarity();
    testExpandWithReferences();
    testLoadRagChunks();
    await testRetrieveRelevantChunks();
    console.log('\n--- Ergebnis ---');
    console.log('Bestanden: ' + passed + ', Fehlgeschlagen: ' + failed);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error('Runner-Fehler:', e);
    process.exit(1);
});
