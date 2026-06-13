/** Max. Nachrichten pro Batch-Lauf (Boss-Inbox-Drain). */
export const FORENSIC_INBOX_FETCH_MAX_MESSAGES = 500

/** Seitengröße für fetchLastMessages. */
export const FORENSIC_INBOX_FETCH_PAGE_SIZE = 500

/** Schutz vor Endlos-Pagination (hasMore-Bug / RPC). */
export const FORENSIC_INBOX_FETCH_MAX_PAGES = 20

/** Nonce-Basis: ms × Faktor (Kollisionen innerhalb einer TX vermeiden). */
export const FORENSIC_BATCH_NONCE_MS_FACTOR = 1000n
