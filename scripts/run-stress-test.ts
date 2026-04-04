/**
 * Stresstest: GET /api/status und POST /api/command (/help) gegen laufende API.
 * Misst Latenzen, p95, Fehlerrate. Exit 1 wenn Schwellen verletzt.
 *
 * WICHTIG: Dies ist ein API-/Infra-Stresstest, KEIN KI-Stresstest.
 * - Es werden weder /api/ai-copilot noch Ollama aufgerufen.
 * - Latenzen sind daher sehr niedrig (lokal oft <1 ms → Anzeige 0 ms bei Rundung).
 * - Hohe Req/s belegen Stabilität der API unter Last, nicht der KI.
 * Für echte KI-Last: siehe docs/STRESS-TEST-README.md bzw. test:stress:ollama (falls vorhanden).
 *
 * Voraussetzung: Morgendrot-API läuft (z. B. npm run start, API_PORT=3342).
 * Aufruf: npm run test:stress [-- --duration=60 --base=http://127.0.0.1:3342]
 *
 * Schwellen (konfigurierbar): p95 < 2000 ms, Fehlerrate 0%.
 */
const DEFAULT_BASE = process.env.API_BASE || 'http://127.0.0.1:3342';
const DEFAULT_DURATION_MS = 60 * 1000; // 1 Min
const P95_THRESHOLD_MS = 2000;
const ERROR_RATE_THRESHOLD = 0;

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
// --duration in Sekunden (z. B. 60 oder 5); intern in ms
const durationSec = parseArgNum('--duration', DEFAULT_DURATION_MS / 1000);
const durationMs = durationSec * 1000;

const latencies: number[] = [];
let errors = 0;
let requests = 0;

async function measureGet(path: string): Promise<boolean> {
    const start = performance.now();
    try {
        const res = await fetch(`${base}${path}`, { method: 'GET' });
        const _ = await res.text();
        latencies.push(performance.now() - start);
        requests++;
        return res.ok;
    } catch (_e) {
        latencies.push(performance.now() - start);
        requests++;
        errors++;
        return false;
    }
}

async function measurePostCommand(cmd: string, args: string[]): Promise<boolean> {
    const start = performance.now();
    try {
        const res = await fetch(`${base}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cmd, args }),
        });
        const _ = await res.text();
        latencies.push(performance.now() - start);
        requests++;
        return res.ok;
    } catch (_e) {
        latencies.push(performance.now() - start);
        requests++;
        errors++;
        return false;
    }
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const i = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, i)];
}

async function run(): Promise<void> {
    console.log('Morgendrot – Stresstest');
    console.log('Base:', base, '| Dauer:', durationSec, 's');
    console.log('Schwellen: p95 <', P95_THRESHOLD_MS, 'ms, Fehlerrate', ERROR_RATE_THRESHOLD * 100, '%\n');

    try {
        const r = await fetch(`${base}/api/status`, { method: 'GET' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
        console.error('API nicht erreichbar unter', base, '–', (e as Error)?.message || e);
        console.error('Bitte zuerst Morgendrot starten (z. B. npm run start).');
        process.exit(1);
    }

    const deadline = Date.now() + durationMs;
    const round = async () => {
        await measureGet('/api/status');
        await measurePostCommand('/help', []);
    };

    while (Date.now() < deadline) {
        await round();
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.length ? latencies.reduce((s, x) => s + x, 0) / latencies.length : 0;
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);
    const errorRate = requests ? errors / requests : 0;

    console.log('--- Ergebnis ---');
    console.log('Requests:', requests, '| Fehler:', errors);
    console.log('Latenz: avg', Math.round(avg), 'ms | p95', Math.round(p95), 'ms | p99', Math.round(p99), 'ms');
    console.log('Fehlerrate:', (errorRate * 100).toFixed(2), '%');
    console.log('(Hinweis: Nur /api/status + /api/command /help – kein Ollama/AI-Copilot.)');

    const p95Fail = p95 >= P95_THRESHOLD_MS;
    const rateFail = errorRate > ERROR_RATE_THRESHOLD;
    if (p95Fail || rateFail) {
        console.log('\n[FAIL] Schwellen verletzt:');
        if (p95Fail) console.log('  - p95', p95.toFixed(0), 'ms >=', P95_THRESHOLD_MS, 'ms');
        if (rateFail) console.log('  - Fehlerrate', (errorRate * 100).toFixed(2), '% >', ERROR_RATE_THRESHOLD * 100, '%');
        process.exit(1);
    }
    console.log('\n[OK] Schwellen eingehalten.');
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
