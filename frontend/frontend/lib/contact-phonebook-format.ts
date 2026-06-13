/** Telefonbuch: Adress-Maskierung und Datumsformat. */

export function maskWalletAddress(addr: string, head = 10, tail = 6): string {
  const t = addr.trim()
  if (t.length < head + tail + 3) return t || '—'
  return `${t.slice(0, head)}…${t.slice(-tail)}`
}

export function formatContactLastSeen(ts: number | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return '—'
  try {
    return new Intl.DateTimeFormat('de-DE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return '—'
  }
}

export type PhonebookFilterId = 'all' | 'lora' | 'online' | 'mailbox' | 'recent'

export const PHONEBOOK_FILTER_LABELS: Record<PhonebookFilterId, string> = {
  all: 'All',
  lora: 'LoRa',
  online: 'Online',
  mailbox: 'Private mailbox',
  recent: 'Recent',
}
