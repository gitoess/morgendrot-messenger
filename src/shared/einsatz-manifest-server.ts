/**
 * § H.33 — Server-Hilfen für Einsatz-Manifest-API (Einsatz-ID, Move-Adresse).
 */
import { createHash } from 'node:crypto';

/** Spiegelt `resolveEinsatzIdFromHandoff` — ohne Browser-Handoff-Snapshot. */
export function resolveServerEinsatzIdUtf8(opts: {
    handoffLabel?: string;
    packageId?: string;
    queryOverride?: string;
}): string {
    const q = opts.queryOverride?.trim();
    if (q) return q;
    const label = (opts.handoffLabel ?? '').trim() || 'einsatz';
    const pkg = (opts.packageId ?? '').trim() || 'local';
    return `${label}-${pkg.slice(0, 10)}`;
}

/** Spiegelt `einsatzIdUtf8ToMoveAddress` (SHA-256, erste 32 Bytes als 0x-Adresse). */
export function einsatzIdUtf8ToMoveAddressSync(einsatzId: string): string {
    const h = createHash('sha256')
        .update(einsatzId.trim() || 'einsatz', 'utf8')
        .digest('hex');
    return `0x${h.slice(0, 64)}`;
}
