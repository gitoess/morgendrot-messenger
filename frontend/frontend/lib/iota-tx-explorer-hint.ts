'use client'

/**
 * Kurzer Explorer-Link für eine abgeschlossene IOTA-Transaktion (Digest).
 * Override: **`NEXT_PUBLIC_IOTA_TX_EXPLORER_BASE`** (ohne trailing slash), z. B. `https://explorer.iota.org/txblock`.
 */

export function explorerTxUrlFromDigest(digest: string): string {
  const d = digest.trim()
  const base =
    (typeof process !== 'undefined' &&
      typeof process.env?.NEXT_PUBLIC_IOTA_TX_EXPLORER_BASE === 'string' &&
      process.env.NEXT_PUBLIC_IOTA_TX_EXPLORER_BASE.trim()) ||
    'https://explorer.iota.org/txblock'
  const b = base.replace(/\/$/, '')
  return `${b}/${encodeURIComponent(d)}`
}

/** Anhängsel für Statuszeilen (kurz, mit URL). */
export function formatTxDigestStatusSuffix(digest?: string | null): string {
  if (digest == null || !String(digest).trim()) return ''
  const d = String(digest).trim()
  const short = d.length > 14 ? `${d.slice(0, 12)}…` : d
  return ` · Tx ${short} — ${explorerTxUrlFromDigest(d)}`
}
