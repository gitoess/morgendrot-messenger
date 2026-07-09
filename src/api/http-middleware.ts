/**
 * HTTP-Hilfen für `api-server.ts` (Slice 4): CORS, JSON, Static/SPA, Formatierung.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CFG } from '../config.js';
import { isAllowedApiCorsOrigin, isPrivateLanOrigin } from './routes/api-security.js';

export function corsHeaders(req: http.IncomingMessage): Record<string, string> {
    const origin = req.headers.origin;
    const defaultOrigin = 'http://127.0.0.1:' + CFG.UI_PORT;
    const isCapacitorOrigin = typeof origin === 'string' && origin.startsWith('capacitor://');
    const originAllowed =
        !origin ||
        origin === 'null' ||
        origin === '' ||
        isCapacitorOrigin ||
        isAllowedApiCorsOrigin(origin, req);
    const isLocal =
        originAllowed ||
        /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin || '') ||
        (typeof origin === 'string' && isPrivateLanOrigin(origin) && !CFG.API_STRICT_CORS);
    const allowOrigin = isLocal && origin ? origin : defaultOrigin;
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Morgendrot-Api-Token',
    };
}

export function sendJson(res: http.ServerResponse, status: number, data: object, cors?: Record<string, string>) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...(cors || {}) });
    res.end(JSON.stringify(data));
}

/** OPTIONS-Preflight; `true` wenn die Anfrage beantwortet wurde. */
export function handleCorsPreflightIfOptions(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: Record<string, string>
): boolean {
    if (req.method !== 'OPTIONS') return false;
    res.writeHead(204, cors);
    res.end();
    return true;
}

/** Pfad ohne Query; trailing slash außer `/` entfernen. */
export function normalizeApiRequestPath(rawPath: string): string {
    const pathOnly = rawPath.split('?')[0] || '/';
    return pathOnly.length > 1 && pathOnly.endsWith('/') ? pathOnly.replace(/\/+$/, '') : pathOnly;
}

export function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function markdownToHtml(md: string): string {
    return escapeHtml(md)
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^\*\*(.+?)\*\*/gm, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^```[\s\S]*?^```/gm, (m) => '<pre><code>' + m.replace(/^```\w*\n?|```$/g, '').trim() + '</code></pre>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/^---$/gm, '<hr>')
        .replace(/\n/g, '<br>\n');
}

export function mask(s: string, showChars = 8): string {
    if (!s) return '';
    if (s.length <= showChars * 2) return s.slice(0, 4) + '…';
    return s.slice(0, showChars) + '…' + s.slice(-4);
}

/** Kurzdarstellung von RPC_URL (Host + ggf. Pfad) für Status-UI — kein Geheimnis. */
export function rpcUrlLabel(url: string): string {
    const u = (url || '').trim();
    if (!u) return '';
    try {
        const p = new URL(u);
        const pathPart = p.pathname && p.pathname !== '/' ? p.pathname.replace(/\/$/, '') : '';
        const pathShort = pathPart.length > 40 ? `${pathPart.slice(0, 37)}…` : pathPart;
        return pathShort ? `${p.host}${pathShort}` : p.host;
    } catch {
        return u.length > 48 ? `${u.slice(0, 45)}…` : u;
    }
}

/** Anzeige-Saldo für GET /api/status: MIST → lesbare IOTA-Zahl (de-DE). */
export function formatWalletNativeIotaForStatusUi(mist: bigint): string {
    const asNum = Number(mist);
    if (!Number.isFinite(asNum) || asNum < 0) return '0';
    const iota = asNum / 1_000_000_000;
    if (iota === 0) return '0';
    if (iota >= 1_000_000) {
        return `${(iota / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio`;
    }
    return iota.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 6 });
}

/**
 * Lite-UI (GET, nicht /api): statisch aus `ui/` oder Hinweis bei SERVE_LITE_UI_STATIC=false.
 * `true` wenn die Anfrage beantwortet wurde.
 */
export function tryServeLiteUiGet(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>
): boolean {
    if (req.method !== 'GET' || url.startsWith('/api')) return false;

    if (!CFG.SERVE_LITE_UI_STATIC) {
        const nextHint = `http://127.0.0.1:${CFG.UI_PORT}/`;
        if (url === '/' || url === '/index.html') {
            const body = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Morgendrot API</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem"><p>Statische Lite-UI ist aus (<code>SERVE_LITE_UI_STATIC=false</code>).</p><p>Next-Dashboard: <a href="${nextHint}">${nextHint}</a></p><p>API: <a href="/api/status">/api/status</a></p></body></html>`;
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...cors });
            res.end(body);
            return true;
        }
        sendJson(
            res,
            404,
            {
                ok: false,
                error:
                    'Lite-UI am API-Port aus (SERVE_LITE_UI_STATIC=false). Nur /api/* — Oberfläche unter UI_PORT (Next).',
            },
            cors
        );
        return true;
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const uiDir = path.resolve(__dirname, '..', '..', 'ui');
    const safePath = url === '/' || url === '/index.html' ? 'index.html' : url.replace(/^\//, '').replace(/\.\./g, '');
    const filePath = path.join(uiDir, safePath === '' ? 'index.html' : safePath);
    if (!filePath.startsWith(uiDir)) {
        sendJson(res, 403, { ok: false, error: 'Forbidden' }, cors);
        return true;
    }
    try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ct = filePath.endsWith('.html')
                ? 'text/html'
                : filePath.endsWith('.js')
                  ? 'application/javascript'
                  : filePath.endsWith('.css')
                    ? 'text/css'
                    : 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': ct, ...cors });
            res.end(fs.readFileSync(filePath));
            return true;
        }
    } catch {
        /* fall through */
    }
    return false;
}

/** Favicon + 404 für unbekannte Routen (nach allen API-Handlern). */
export function sendUnmatchedRouteResponse(
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>
): void {
    if (url === '/favicon.ico') {
        res.writeHead(204, cors);
        res.end();
        return;
    }
    sendJson(res, 404, { ok: false, error: 'Route nicht gefunden: ' + url }, cors);
}
