/**
 * Roh-String-Persistenz (z. B. `localStorage`, `fs`, IndexedDB-Adapter).
 * Die Offline-Mailbox-Codec-Funktionen arbeiten auf Strings; konkretes Keying bleibt beim Adapter.
 */
export type StringStoragePort = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
