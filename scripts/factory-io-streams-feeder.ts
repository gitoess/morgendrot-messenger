/**
 * Liest periodisch die Factory I/O Web-API (Tags) und veröffentlicht die Werte
 * als Nachrichten in die Morgendrot-Streams-Bridge. So erscheinen simulierte
 * Sensoren/Aktoren in Morgendrot unter Streams/Überwachung.
 *
 * Optional: factory-io-map.json – ordnet Tag-Namen/IDs festen Signalen zu (siehe
 * scripts/factory-io-map.example.json), damit Morgendrot „weiß“, welcher Schalter
 * welche Bedeutung hat.
 *
 * Voraussetzung: Factory I/O Ultimate, Web-API aktiv (app.web_server = True, Port 7410).
 *
 * Env:
 *   FACTORY_IO_URL          – Basis-URL (überschreibt UI). Default: aus Backend /api/config oder http://127.0.0.1:7410
 *   STREAMS_BRIDGE_URL      – Bridge (default http://127.0.0.1:9343)
 *   STREAMS_ANCHOR_ID       – Kanal-ID; muss gesetzt sein, damit publiziert wird
 *   FACTORY_IO_POLL_MS      – Poll-Intervall in ms (überschreibt UI). Wenn nicht gesetzt: Wert aus Morgendrot-UI (.env), Default 10000
 *   MORGENDROT_API_URL      – Backend für /api/config (default http://127.0.0.1:3342)
 *   FACTORY_IO_MAP_FILE     – Pfad zur Mapping-JSON (default: ./factory-io-map.json falls vorhanden)
 *   FACTORY_IO_PUBLISH_ON_CHANGE – true/1: nur publizieren, wenn sich mindestens ein Tag-Wert geändert hat
 *
 * Start: npm run factory-io-feeder
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STREAMS_BRIDGE_URL = (process.env.STREAMS_BRIDGE_URL || 'http://127.0.0.1:9343').replace(/\/$/, '');
const STREAMS_ANCHOR_ID = (process.env.STREAMS_ANCHOR_ID || '').trim();
const MORGENDROT_API_URL = (process.env.MORGENDROT_API_URL || process.env.API_BASE || 'http://127.0.0.1:3342').replace(/\/$/, '');
const ENV_FACTORY_IO_URL = process.env.FACTORY_IO_URL?.trim();
const ENV_POLL_MS_RAW = process.env.FACTORY_IO_POLL_MS?.trim();
const ENV_MAP_FILE = process.env.FACTORY_IO_MAP_FILE?.trim();
const ENV_PUBLISH_ON_CHANGE = /^(1|true|yes)$/i.test(process.env.FACTORY_IO_PUBLISH_ON_CHANGE || '');

interface FactoryIOTag {
    name?: string;
    id?: string;
    address?: number;
    type?: string;
    kind?: string;
    value?: boolean | number;
    openCircuit?: boolean;
    shortCircuit?: boolean;
    isForced?: boolean;
    forcedValue?: boolean | number;
}

interface ConfigRow {
    envKey?: string;
    key?: string;
    value?: string;
}

interface MapEntry {
    signal: string;
    description?: string;
    tagId?: string;
    nameEquals?: string;
    nameContains?: string;
}

interface MapFile {
    mappings?: MapEntry[];
    includeAllTags?: boolean;
    publishOnChangeOnly?: boolean;
}

function log(msg: string): void {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${msg}`);
}

function loadMapFile(quiet = false): MapFile | null {
    const candidates: string[] = [];
    if (ENV_MAP_FILE) candidates.push(resolve(process.cwd(), ENV_MAP_FILE));
    candidates.push(resolve(process.cwd(), 'factory-io-map.json'));
    for (const p of candidates) {
        if (!existsSync(p)) continue;
        try {
            const raw = readFileSync(p, 'utf-8');
            const parsed = JSON.parse(raw) as MapFile;
            if (!quiet) log(`Mapping geladen: ${p} (${(parsed.mappings || []).length} Regel(n))`);
            return parsed;
        } catch (e) {
            if (!quiet) log(`Mapping-Datei ungültig (${p}): ${(e as Error).message}`);
            return null;
        }
    }
    return null;
}

function tagMatches(entry: MapEntry, t: FactoryIOTag): boolean {
    const id = (t.id || '').trim();
    const name = (t.name || '').trim();
    if (entry.tagId && id && id.toLowerCase() === entry.tagId.trim().toLowerCase()) return true;
    if (entry.nameEquals && name.toLowerCase() === entry.nameEquals.trim().toLowerCase()) return true;
    if (entry.nameContains && name.toLowerCase().includes(entry.nameContains.trim().toLowerCase())) return true;
    return false;
}

function buildSignals(tags: FactoryIOTag[], map: MapFile | null): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!map?.mappings?.length) return out;
    for (const entry of map.mappings) {
        if (!entry.signal?.trim()) continue;
        const matches = tags.filter((t) => tagMatches(entry, t));
        if (matches.length === 0) continue;
        const desc = entry.description || '';
        if (matches.length === 1) {
            const t = matches[0];
            out[entry.signal] = {
                value: t.value,
                factoryTagId: t.id,
                factoryTagName: t.name,
                type: t.type,
                kind: t.kind,
                ...(desc ? { description: desc } : {}),
            };
        } else {
            out[entry.signal] = {
                ...(desc ? { description: desc } : {}),
                items: matches.map((t) => ({
                    value: t.value,
                    factoryTagId: t.id,
                    factoryTagName: t.name,
                    type: t.type,
                    kind: t.kind,
                })),
            };
        }
    }
    return out;
}

function fingerprintTagValues(tags: FactoryIOTag[]): string {
    const pairs = tags
        .map((t) => [String(t.id || t.name || ''), JSON.stringify(t.value)] as const)
        .filter(([k]) => k)
        .sort((a, b) => a[0].localeCompare(b[0]));
    return JSON.stringify(pairs);
}

async function fetchMorgendrotFactoryConfig(): Promise<{ factoryIoUrl?: string; pollMs?: number }> {
    try {
        const res = await fetch(`${MORGENDROT_API_URL}/api/config`, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) return {};
        const data = (await res.json()) as { config?: ConfigRow[] };
        const cfg = data.config || [];
        const row = (k: string) => cfg.find((c) => (c.envKey || c.key) === k);
        const urlRow = row('FACTORY_IO_URL');
        const pollRow = row('FACTORY_IO_POLL_MS');
        let factoryIoUrl: string | undefined;
        const uv = urlRow?.value?.trim();
        if (uv && uv !== '(leer)') factoryIoUrl = uv.replace(/\/$/, '');
        let pollMs: number | undefined;
        const pv = pollRow?.value?.trim();
        if (pv && pv !== '(leer)') {
            const n = parseInt(pv, 10);
            if (Number.isFinite(n)) pollMs = Math.min(86400000, Math.max(500, n));
        }
        return { factoryIoUrl, pollMs };
    } catch {
        return {};
    }
}

function effectiveFactoryIoUrl(fromBackend?: string): string {
    if (ENV_FACTORY_IO_URL) return ENV_FACTORY_IO_URL.replace(/\/$/, '');
    if (fromBackend) return fromBackend.replace(/\/$/, '');
    return 'http://127.0.0.1:7410';
}

function effectivePollMs(fromBackend?: number): number {
    if (ENV_POLL_MS_RAW !== undefined && ENV_POLL_MS_RAW !== '') {
        const n = parseInt(ENV_POLL_MS_RAW, 10);
        if (Number.isFinite(n)) return Math.min(86400000, Math.max(500, n));
    }
    if (fromBackend !== undefined && Number.isFinite(fromBackend)) return fromBackend;
    return 10000;
}

function pollSourceLabel(remotePoll: number | undefined): string {
    if (ENV_POLL_MS_RAW !== undefined && ENV_POLL_MS_RAW !== '') return 'env FACTORY_IO_POLL_MS';
    if (remotePoll !== undefined) return 'UI/Backend (.env nach Setzen)';
    return 'Default 10000 ms';
}

function urlSourceLabel(hasBackendUrl: boolean): string {
    if (ENV_FACTORY_IO_URL) return 'env FACTORY_IO_URL';
    if (hasBackendUrl) return 'UI/Backend';
    return 'Default http://127.0.0.1:7410';
}

async function fetchFactoryIOTags(baseUrl: string): Promise<FactoryIOTag[]> {
    const url = `${baseUrl.replace(/\/$/, '')}/api/tags`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Factory I/O: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

async function publishToBridge(payload: string): Promise<void> {
    if (!STREAMS_ANCHOR_ID) return;
    const url = STREAMS_BRIDGE_URL;
    const body = JSON.stringify({
        anchor: STREAMS_ANCHOR_ID,
        payload,
        sender: 'factory-io',
    });
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Bridge: ${res.status} ${res.statusText}`);
}

function shouldIncludeAllTags(map: MapFile | null): boolean {
    if (!map) return true;
    if (map.includeAllTags === false) return false;
    return true;
}

function shouldPublishOnChangeOnly(map: MapFile | null): boolean {
    if (ENV_PUBLISH_ON_CHANGE) return true;
    return map?.publishOnChangeOnly === true;
}

async function runOnce(
    factoryIoBase: string,
    map: MapFile | null,
    state: { lastFingerprint: string; mapReloadCounter: number },
): Promise<{ published: boolean; tagCount: number }> {
    const tags = await fetchFactoryIOTags(factoryIoBase);
    const fingerprint = fingerprintTagValues(tags);
    const onChangeOnly = shouldPublishOnChangeOnly(map);
    if (onChangeOnly && state.lastFingerprint === fingerprint && state.lastFingerprint !== '') {
        return { published: false, tagCount: tags.length };
    }
    state.lastFingerprint = fingerprint;

    const signals = buildSignals(tags, map);
    const snapshot: Record<string, unknown> = {
        ts: Date.now(),
        source: 'factory-io',
        tagCount: tags.length,
        signalCount: Object.keys(signals).length,
        signals,
    };
    if (shouldIncludeAllTags(map)) {
        snapshot.tags = tags.map((t) => ({
            name: t.name,
            id: t.id,
            type: t.type,
            kind: t.kind,
            value: t.value,
        }));
    }
    const payload = JSON.stringify(snapshot);
    if (STREAMS_ANCHOR_ID) {
        await publishToBridge(payload);
        const sigHint = Object.keys(signals).length ? `, ${Object.keys(signals).length} Signal(e)` : '';
        log(`Published ${tags.length} tags${sigHint} → anchor ${STREAMS_ANCHOR_ID.slice(0, 8)}…`);
        return { published: true, tagCount: tags.length };
    }
    log(`Tags (no STREAMS_ANCHOR_ID): ${tags.length} – ${payload.slice(0, 120)}…`);
    return { published: false, tagCount: tags.length };
}

async function loop(): Promise<void> {
    let map = loadMapFile();
    const remote0 = await fetchMorgendrotFactoryConfig();
    const f0 = effectiveFactoryIoUrl(remote0.factoryIoUrl);
    const p0 = effectivePollMs(remote0.pollMs);
    log(
        `Factory I/O Feeder: ${f0} → ${STREAMS_BRIDGE_URL} (anchor: ${STREAMS_ANCHOR_ID || '(not set, dry run)'}, poll ${p0} ms – ${pollSourceLabel(remote0.pollMs)})`,
    );
    log(`  Morgendrot API: ${MORGENDROT_API_URL} (${urlSourceLabel(Boolean(remote0.factoryIoUrl))})`);
    if (map) {
        log(`  publishOnChangeOnly: ${shouldPublishOnChangeOnly(map)} (Env FACTORY_IO_PUBLISH_ON_CHANGE oder Map)`);
        log(`  includeAllTags: ${shouldIncludeAllTags(map)}`);
    } else {
        log('  Kein factory-io-map.json – nur Roh-Liste „tags“. Siehe scripts/factory-io-map.example.json');
    }
    if (!STREAMS_ANCHOR_ID) log('Set STREAMS_ANCHOR_ID to publish to Morgendrot (e.g. from UI: Streams → Kanal erstellen).');

    let lastF = f0;
    let lastP = p0;
    const state = { lastFingerprint: '', mapReloadCounter: 0 };

    for (;;) {
        state.mapReloadCounter++;
        if (state.mapReloadCounter % 30 === 1) map = loadMapFile(true);

        const remote = await fetchMorgendrotFactoryConfig();
        const fioUrl = effectiveFactoryIoUrl(remote.factoryIoUrl);
        const pollMs = effectivePollMs(remote.pollMs);

        if (fioUrl !== lastF || pollMs !== lastP) {
            log(`Config geändert: ${fioUrl}, poll ${pollMs} ms (${pollSourceLabel(remote.pollMs)})`);
            lastF = fioUrl;
            lastP = pollMs;
        }

        try {
            await runOnce(fioUrl, map, state);
        } catch (e) {
            log(`Error: ${(e as Error).message}`);
        }
        await new Promise((r) => setTimeout(r, pollMs));
    }
}

loop().catch((e) => {
    console.error(e);
    process.exit(1);
});
