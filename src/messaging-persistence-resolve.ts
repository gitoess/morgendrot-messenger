/**
 * SSOT Phase A: Klartext-Persistenz „event“ vs. „mailbox“ → Move-Pfad (Event vs. store_plaintext_*).
 * @see docs/MESSAGING-MAILBOX-SSOT-SPEC.md § 3 Phase A
 */

export function resolveForceLegacyPlaintext(opts?: {
    messagingPersistenceMode?: string | null;
    forceLegacyPlaintext?: boolean;
}): boolean {
    if (opts?.forceLegacyPlaintext !== undefined) return opts.forceLegacyPlaintext;
    const mp = String(opts?.messagingPersistenceMode ?? '').trim().toLowerCase();
    return mp !== 'mailbox';
}

/** `true` → `send_encrypted_message` (Event); `false` → `store_encrypted_message*` (Mailbox). */
export function resolveForceLegacyEncrypted(opts?: {
    messagingPersistenceMode?: string | null;
    forceLegacyEncrypted?: boolean;
}): boolean {
    if (opts?.forceLegacyEncrypted !== undefined) return opts.forceLegacyEncrypted;
    const mp = String(opts?.messagingPersistenceMode ?? '').trim().toLowerCase();
    if (mp === 'event') return true;
    if (mp === 'mailbox') return false;
    /** Feld fehlt (CLI/Legacy): Default mailbox — SSOT § Auflösungstabelle. */
    return false;
}

export type MailboxEncryptedConfigSnapshot = {
    useMailbox?: boolean;
    mailboxId?: string | null;
    packageId?: string | null;
};

/** `null` = verschlüsselte Mailbox ist möglich; sonst menschenlesbarer Grund. */
export function explainMailboxEncryptedUnavailable(
    cfg: MailboxEncryptedConfigSnapshot,
    wantsMailbox: boolean
): string | null {
    if (!wantsMailbox) return null;
    const mailboxId = (cfg.mailboxId ?? '').trim();
    const packageId = (cfg.packageId ?? '').trim();
    if (!cfg.useMailbox) {
        return 'Verschlüsselte Mailbox: USE_MAILBOX ist aus — Server-.env prüfen oder „Event“ wählen.';
    }
    if (!mailboxId || !/^0x[a-fA-F0-9]{64}$/i.test(mailboxId)) {
        return 'Verschlüsselte Mailbox: MAILBOX_ID fehlt oder ist ungültig (0x + 64 Hex).';
    }
    if (packageId && mailboxId.toLowerCase() === packageId.toLowerCase()) {
        return 'Verschlüsselte Mailbox: MAILBOX_ID darf nicht der PACKAGE_ID entsprechen.';
    }
    return null;
}

export type MailboxPlaintextConfigSnapshot = {
    useMailbox?: boolean;
    mailboxId?: string | null;
    packageId?: string | null;
    mailboxStorePlaintext?: boolean;
};

/** `null` = Mailbox-Klartext ist möglich; sonst menschenlesbarer Grund. */
export function explainMailboxPlaintextUnavailable(
    cfg: MailboxPlaintextConfigSnapshot,
    wantsMailbox: boolean
): string | null {
    if (!wantsMailbox) return null;
    const mailboxId = (cfg.mailboxId ?? '').trim();
    const packageId = (cfg.packageId ?? '').trim();
    if (!cfg.useMailbox) {
        return 'Klartext-Mailbox: USE_MAILBOX ist aus — in der Server-.env aktivieren oder Transport „Nur Event“ wählen.';
    }
    if (!mailboxId || !/^0x[a-fA-F0-9]{64}$/i.test(mailboxId)) {
        return 'Klartext-Mailbox: MAILBOX_ID fehlt oder ist ungültig (0x + 64 Hex, geteiltes Postamt-Objekt — nicht die Package-ID).';
    }
    if (packageId && mailboxId.toLowerCase() === packageId.toLowerCase()) {
        return 'Klartext-Mailbox: MAILBOX_ID darf nicht der PACKAGE_ID entsprechen (Chain-Fehler „move package passed“).';
    }
    if (!cfg.mailboxStorePlaintext) {
        return 'Klartext-Mailbox: MAILBOX_STORE_PLAINTEXT ist aus — in der Server-.env aktivieren oder „Nur Event“ wählen.';
    }
    return null;
}
