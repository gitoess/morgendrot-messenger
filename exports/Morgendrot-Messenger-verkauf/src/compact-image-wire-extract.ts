/**
 * Server: Base64-Blob aus MORG_COMPACT_IMG_V1-Wire extrahieren (JSON-Hülle, ZWSP/Vollbreite, Slice ab [[).
 * Spiegelt die wichtigsten Frontend-Fälle für /api/compact-image-preview und Skripte.
 */
const WIRE_PREFIX = '[[MORG_COMPACT_IMG_V1:';
const SUFFIX = ']]';

function lightNorm(s: string): string {
    return s
        .trim()
        .replace(/^\uFEFF/, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
        .replace(/\u00AD/g, '')
        .replace(/\uFF3B/g, '[')
        .replace(/\uFF3D/g, ']')
        .replace(/\uFF1A/g, ':')
        .trimStart();
}

function collectMorgStrings(v: unknown, depth: number, acc: string[]): void {
    if (depth > 8) return;
    if (typeof v === 'string') {
        if (v.includes('[[MORG_')) acc.push(v);
        return;
    }
    if (Array.isArray(v)) {
        for (const x of v) collectMorgStrings(x, depth + 1, acc);
        return;
    }
    if (v && typeof v === 'object') {
        for (const x of Object.values(v as Record<string, unknown>)) collectMorgStrings(x, depth + 1, acc);
    }
}

function unwrapJsonLongestMorg(s: string): string {
    const t = s.trim();
    if (!t.startsWith('{') && !t.startsWith('[')) return s;
    try {
        const parsed = JSON.parse(t) as unknown;
        const acc: string[] = [];
        collectMorgStrings(parsed, 0, acc);
        if (acc.length === 0) return s;
        acc.sort((a, b) => b.length - a.length);
        return acc[0]!;
    } catch {
        return s;
    }
}

function fullNormalizeLikeClient(s: string): string {
    let t = unwrapJsonLongestMorg(s.trim());
    if (t.startsWith('"') && t.endsWith('"')) {
        try {
            const once = JSON.parse(t) as unknown;
            if (typeof once === 'string') t = once;
        } catch {
            /* ignore */
        }
    }
    t = unwrapJsonLongestMorg(t);
    return lightNorm(t);
}

function tryExtractB64(normalized: string): string | null {
    const idx = normalized.indexOf(WIRE_PREFIX);
    if (idx === -1) return null;
    const tail = normalized.slice(idx);
    const end = tail.indexOf(SUFFIX, WIRE_PREFIX.length);
    if (end === -1) return null;
    const b64 = tail.slice(WIRE_PREFIX.length, end).replace(/\s/g, '');
    return b64.length ? b64 : null;
}

function pushUnique(out: string[], seen: Set<string>, chunk: string): void {
    const z = chunk.trim();
    if (!z.length || seen.has(z)) return;
    seen.add(z);
    out.push(z);
}

export function extractCompactImageBase64FromWire(rawWire: string): string | null {
    const raw = String(rawWire ?? '').trim();
    const seen = new Set<string>();
    const candidates: string[] = [];
    pushUnique(candidates, seen, raw);
    pushUnique(candidates, seen, lightNorm(raw));
    pushUnique(candidates, seen, fullNormalizeLikeClient(raw));

    try {
        const t0 = raw.trim();
        if (t0.startsWith('{') || t0.startsWith('[')) {
            const parsed = JSON.parse(t0) as unknown;
            const acc: string[] = [];
            collectMorgStrings(parsed, 0, acc);
            for (const inner of acc) {
                pushUnique(candidates, seen, inner);
                pushUnique(candidates, seen, lightNorm(inner));
                pushUnique(candidates, seen, fullNormalizeLikeClient(inner));
            }
        }
    } catch {
        /* ignore */
    }

    const needle = 'MORG_COMPACT_IMG_V1:';
    const ix = raw.indexOf(needle);
    if (ix !== -1) {
        const start = raw.lastIndexOf('[[', ix);
        if (start >= 0) pushUnique(candidates, seen, raw.slice(start));
    }

    candidates.sort((a, b) => b.length - a.length);

    for (const c of candidates) {
        const tried = new Set<string>();
        for (const n of [fullNormalizeLikeClient(c), lightNorm(c), c.trim()]) {
            if (!n.trim() || tried.has(n)) continue;
            tried.add(n);
            const r = tryExtractB64(n);
            if (r) return r;
        }
    }
    return null;
}
