/**
 * M4b: temporär andere MAILBOX_ID für einen Send-/Store-Aufruf (Kontakt-private Mailbox).
 */
import { CFG } from './config.js';

export function normalizeMailboxObjectIdForTx(id: string | null | undefined): string | null {
    const t = (id ?? '').trim();
    if (!/^0x[a-fA-F0-9]{64}$/i.test(t)) return null;
    const pkg = (CFG.PACKAGE_ID || '').trim().toLowerCase();
    if (pkg && t.toLowerCase() === pkg) return null;
    return t;
}

export async function runWithMailboxObjectIdOverride<T>(
    overrideId: string | null | undefined,
    fn: () => Promise<T>
): Promise<T> {
    const use = normalizeMailboxObjectIdForTx(overrideId);
    if (!use) return fn();
    const prev = CFG.MAILBOX_ID;
    (CFG as { MAILBOX_ID: string }).MAILBOX_ID = use;
    try {
        return await fn();
    } finally {
        (CFG as { MAILBOX_ID: string }).MAILBOX_ID = prev;
    }
}
