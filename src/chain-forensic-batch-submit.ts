/**
 * Forensic-Batch-Submit: PTB vs. Einzel-TX-Fallback (§ H.33e).
 */
import { CFG, isMessengerMailboxModeActive } from './config.js'
import { logger } from './logger.js'

export const FORENSIC_BATCH_MAX_ITEMS_PER_TX = 50

export function isForensicMailboxPairValid(packageId: string, mailboxId: string): boolean {
    const pkg = packageId.trim()
    const mb = mailboxId.trim()
    return Boolean(mb && pkg && mb.toLowerCase() !== pkg.toLowerCase())
}

export function isForensicMailboxObjectIdValid(): boolean {
    return isForensicMailboxPairValid(CFG.PACKAGE_ID || '', CFG.MAILBOX_ID || '')
}

export function forensicPlaintextBatchFallbackReason(
    useMailboxForPlaintext: () => boolean,
    mailboxStoresPlaintext: () => boolean,
    messengerCreditsObjectIdForTx: () => string | undefined
): string | null {
    if (!isForensicMailboxObjectIdValid()) return 'MAILBOX_ID fehlt oder gleich PACKAGE_ID'
    if (!useMailboxForPlaintext()) return 'Plaintext-Mailbox-Modus inaktiv'
    if (!mailboxStoresPlaintext()) return 'Mailbox speichert kein Klartext'
    if (messengerCreditsObjectIdForTx()) return 'Messenger-Credits-Pfad (Einzel-TX statt PTB)'
    return null
}

export function forensicEncryptedBatchFallbackReason(
    messengerCreditsObjectIdForTx: () => string | undefined
): string | null {
    if (!isForensicMailboxObjectIdValid()) return 'MAILBOX_ID fehlt oder gleich PACKAGE_ID'
    if (!isMessengerMailboxModeActive()) return 'Mailbox-Modus inaktiv'
    if (messengerCreditsObjectIdForTx()) return 'Messenger-Credits-Pfad (Einzel-TX statt PTB)'
    return null
}

export function logForensicBatchSequentialFallback(mode: 'plain' | 'encrypted', reason: string, count: number): void {
    logger.warn(`Forensic-Batch ${mode}: ${count} Einträge sequentiell (${reason}).`, {
        itemCount: count,
        reason,
    })
}

export function assertForensicBatchItemCount(itemsLength: number): void {
    if (itemsLength > FORENSIC_BATCH_MAX_ITEMS_PER_TX) {
        throw new Error(`Forensic-Batch: max. ${FORENSIC_BATCH_MAX_ITEMS_PER_TX} Einträge pro TX.`)
    }
}
