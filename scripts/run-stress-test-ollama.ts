/**
 * Echter KI-Stresstest: Jeder Request = realer Ollama-Call (RAG + Few-Shot).
 * Mit Warm-Up (erste 10 verworfen), Parallelität (4–8 gleichzeitig), langer Dauer (300 s).
 *
 * Voraussetzung: Morgendrot-API läuft, Ollama mit Modell (z. B. qwen2:7b oder 14b).
 * Aufruf: npm run test:stress:ollama [-- --duration=300 --concurrent=6 --base=http://127.0.0.1:3342]
 *
 * Schwellen: p95 < 6000 ms (14B), Fehlerrate < 0.5 %.
 */
import 'dotenv/config';

const DEFAULT_BASE = process.env.API_BASE || 'http://127.0.0.1:3342';
const DEFAULT_DURATION_SEC = 300;
const DEFAULT_CONCURRENT = 6;
const WARMUP_REQUESTS = 10;
const P95_THRESHOLD_MS = 6000;
const ERROR_RATE_THRESHOLD = 0.005; // 0.5 %

function parseArg(name: string, def: string): string {
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith(name + '=')) return arg.slice(name.length + 1);
        if (arg === name && argv[i + 1]) return argv[i + 1];
    }
    return def;
}

function parseArgNum(name: string, def: number): number {
    const s = parseArg(name, String(def));
    const n = parseInt(s, 10);
    return isNaN(n) ? def : n;
}

const base = parseArg('--base', DEFAULT_BASE).replace(/\/$/, '');
const durationSec = parseArgNum('--duration', DEFAULT_DURATION_SEC);
const concurrent = Math.min(8, Math.max(1, parseArgNum('--concurrent', DEFAULT_CONCURRENT)));
const durationMs = durationSec * 1000;

const OLLAMA_PROMPTS = [
    'Erkläre kurz die Säule 1 und schlage den nächsten Schritt vor, wenn ich mit 0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5 verbinden will.',
    'Was muss ich tun, um einen Gast für 7 Tage Zutritt zu geben? Nenne den konkreten Befehl.',
    'Ich will 0.5 IOTA an 0x2070b0d2e0c893e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e senden. Welche ACTION?',
    'Schritt 1: Package setzen, Schritt 2: Handshake, Schritt 3: Connect – was ist der erste Befehl?',
    'Wie lösche ich einen abgelaufenen Handshake aus der Mailbox und hole den Rebate?',
];

type OneResult = { elapsed: number; ok: boolean; timings?: { ragRetrievalMs?: number; ollamaCallMs?: number; postFilterMs?: number } };

async function oneRequest(promptIndex: number): Promise<OneResult> {
    const prompt = OLLAMA_PROMPTS[promptIndex % OLLAMA_PROMPTS.length];
    const start = performance.now();
    try {
        const res = await fetch(`${base}/api/ai-copilot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt, options: { useIntentMatcher: false, useOllama: true } }),
        });
        const data = (await res.json()) as {
            ok?: boolean;
            timings?: { ragRetrievalMs?: number; ollamaCallMs?: number; postFilterMs?: number };
        };
        const elapsed = performance.now() - start;
        const ok = res.ok && !!data.ok;
        return { elapsed, ok, timings: data.timings };
    } catch (_e) {
        return { elapsed: performance.now() - start, ok: false };
    }
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const i = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, i)];
}

async function main(): Promise<void> {
    console.log('Morgendrot – KI-Stresstest (Ollama + RAG)');
    console.log('Base:', base, '| Dauer:', durationSec, 's | Parallel:', concurrent, '| Warm-Up:', WARMUP_REQUESTS);
    console.log('Schwellen: p95 <', P95_THRESHOLD_MS, 'ms, Fehlerrate <', ERROR_RATE_THRESHOLD * 100, '%\n');

    try {
        const r = await fetch(`${base}/api/status`, { method: 'GET' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
        console.error('API nicht erreichbar unter', base, '–', (e as Error)?.message || e);
        process.exit(1);
    }

    // Warm-Up: erste 10 Requests verwerfen (Modell-Load, Caching)
    console.log('Warm-Up (' + WARMUP_REQUESTS + ' Requests)…');
    for (let i = 0; i < WARMUP_REQUESTS; i++) {
        await oneRequest(i);
    }
    console.log('Warm-Up fertig.\n');

    const latencies: number[] = [];
    const timingsRag: number[] = [];
    const timingsOllama: number[] = [];
    const timingsPost: number[] = [];
    let errors = 0;
    let requestCount = 0;
    const deadline = Date.now() + durationMs;

    while (Date.now() < deadline) {
        const batch = Array.from({ length: concurrent }, (_, i) => oneRequest(requestCount + i));
        requestCount += concurrent;
        const results = await Promise.all(batch);
        for (const r of results) {
            latencies.push(r.elapsed);
            if (!r.ok) errors++;
            if (r.timings) {
                if (typeof r.timings.ragRetrievalMs === 'number') timingsRag.push(r.timings.ragRetrievalMs);
                if (typeof r.timings.ollamaCallMs === 'number') timingsOllama.push(r.timings.ollamaCallMs);
                if (typeof r.timings.postFilterMs === 'number') timingsPost.push(r.timings.postFilterMs);
            }
        }
    }

    const requests = latencies.length;
    if (requests === 0) {
        console.error('Keine Requests nach Warm-Up (API/Ollama prüfen).');
        process.exit(1);
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.reduce((s, x) => s + x, 0) / requests;
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);
    const errorRate = errors / requests;
    const reqPerMin = (requests / durationSec) * 60;

    const mem = process.memoryUsage?.();
    console.log('--- Ergebnis ---');
    console.log('Requests:', requests, '| Fehler:', errors);
    console.log('Req/min:', Math.round(reqPerMin));
    console.log('Latenz: avg', Math.round(avg), 'ms | p50', Math.round(p50), 'ms | p95', Math.round(p95), 'ms | p99', Math.round(p99), 'ms');
    console.log('Fehlerrate:', (errorRate * 100).toFixed(2), '%');
    if (mem) console.log('RSS (Node):', Math.round(mem.rss / 1024 / 1024), 'MB');
    if (timingsOllama.length > 0) {
        const avgRag = timingsRag.length ? timingsRag.reduce((s, x) => s + x, 0) / timingsRag.length : 0;
        const avgOllama = timingsOllama.reduce((s, x) => s + x, 0) / timingsOllama.length;
        const avgPost = timingsPost.length ? timingsPost.reduce((s, x) => s + x, 0) / timingsPost.length : 0;
        console.log('Latenz-Breakdown (Ø): RAG', Math.round(avgRag), 'ms | Ollama', Math.round(avgOllama), 'ms | Post', Math.round(avgPost), 'ms');
    }

    const p95Fail = p95 >= P95_THRESHOLD_MS;
    const rateFail = errorRate > ERROR_RATE_THRESHOLD;
    if (p95Fail || rateFail) {
        console.log('\n[FAIL] Schwellen verletzt:');
        if (p95Fail) console.log('  - p95', Math.round(p95), 'ms >=', P95_THRESHOLD_MS, 'ms');
        if (rateFail) console.log('  - Fehlerrate', (errorRate * 100).toFixed(2), '% >', ERROR_RATE_THRESHOLD * 100, '%');
        process.exit(1);
    }
    console.log('\n[OK] Schwellen eingehalten.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
