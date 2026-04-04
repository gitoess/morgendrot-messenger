/**
 * Kammer „Streams-Brücke“: nur HTTP-Helfer zur Bridge (kein Business-Logic-Mix mit Chain).
 */
import { CFG } from '../config.js';

/** Prüft, ob die Bridge-URL für fetch() gültig ist (http/https, parsebar). */
export function isStreamsBridgeUrlValid(url: string | undefined): boolean {
    if (!url || typeof url !== 'string') return false;
    const t = url.trim();
    if (!t.startsWith('http://') && !t.startsWith('https://')) return false;
    try {
        new URL(t);
        return true;
    } catch {
        return false;
    }
}

export function getStreamsBridgeUrlForFetch(): string | null {
    const u = (CFG.STREAMS_BRIDGE_URL || '').trim().replace(/\/$/, '');
    return isStreamsBridgeUrlValid(u) ? u : null;
}

/** Liste von Bridge-URLs zum Ausprobieren (konfigurierte zuerst, dann Fallback-Ports 3443, 9343 wenn UI oft 3342 läuft). */
export function getStreamsBridgeUrlsToTry(): string[] {
    const u = (CFG.STREAMS_BRIDGE_URL || '').trim().replace(/\/$/, '');
    const urls: string[] = [];
    if (isStreamsBridgeUrlValid(u)) urls.push(u);
    try {
        const parsed = new URL(u || 'http://127.0.0.1');
        const host = parsed.hostname || '127.0.0.1';
        const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
        if (port === 3342 || port === 3343) {
            if (!urls.includes(`http://${host}:3443`)) urls.push(`http://${host}:3443`);
            if (!urls.includes(`http://${host}:9343`)) urls.push(`http://${host}:9343`);
        }
        if (urls.length === 0) {
            urls.push('http://127.0.0.1:3443', 'http://127.0.0.1:9343');
        }
    } catch {
        if (urls.length === 0) urls.push('http://127.0.0.1:3443', 'http://127.0.0.1:9343');
    }
    return urls;
}

export const STREAMS_FETCH_TIMEOUT_MS = 10_000;

/** Fetch mit Timeout (verhindert langes Hängen bei nicht erreichbarer Bridge). */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
    const { timeoutMs = STREAMS_FETCH_TIMEOUT_MS, ...fetchOpts } = options;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...fetchOpts, signal: ctrl.signal });
        clearTimeout(t);
        return res;
    } catch (e) {
        clearTimeout(t);
        if ((e as Error)?.name === 'AbortError')
            throw new Error('Zeitüberschreitung (Bridge nicht erreichbar oder antwortet nicht).');
        throw e;
    }
}
