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
  all: 'Alle',
  lora: 'LoRa',
  online: 'Online',
  mailbox: 'Private Mailbox',
  recent: 'Zuletzt',
}

/** Rollen-Tags für Telefonbuch-Anzeige (max. 20, je 48 Zeichen). */
export function normalizeContactRoleTags(tags?: string[] | null): string[] {
  if (!tags?.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const t = String(raw || '').trim().slice(0, 48)
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= 20) break
  }
  return out
}

export function formatContactRoleTagsCsv(tags?: string[] | null): string {
  return normalizeContactRoleTags(tags).join(', ')
}

export function parseContactRoleTagsCsv(csv: string): string[] {
  if (!csv.trim()) return []
  return normalizeContactRoleTags(csv.split(/[,;]+/))
}
