/**
 * Empfangen/Teilen: ein kombinierter Text/QR aus Wallet + Mailboxen + Kontakt.
 */

export type ReceiveMailboxOption = { id: string; label: string }

export type ReceiveShareSelection = {
  includeWallet: boolean
  walletAddress?: string
  /** Gewählte Mailbox-IDs (mit Labels). */
  mailboxes: ReceiveMailboxOption[]
  includeContact: boolean
  contactName?: string
  contactPhone?: string
  contactNote?: string
}

const LS_MB_LABELS = 'morgendrot.receive.mailboxLabels.v1'

export function readMailboxLabelMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_MB_LABELS)
    if (!raw) return {}
    const j = JSON.parse(raw) as Record<string, string>
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

export function writeMailboxLabel(id: string, label: string): void {
  if (typeof window === 'undefined') return
  const k = id.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(k)) return
  try {
    const map = readMailboxLabelMap()
    const t = label.trim()
    if (!t) delete map[k]
    else map[k] = t.slice(0, 48)
    window.localStorage.setItem(LS_MB_LABELS, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function defaultMailboxLabel(id: string, index: number, primaryId?: string): string {
  const k = id.trim().toLowerCase()
  const primary = (primaryId || '').trim().toLowerCase()
  if (primary && k === primary) return 'Privat'
  if (index === 0 && !primary) return 'Privat'
  return `Postfach ${index + 1}`
}

export function buildReceiveSharePayload(sel: ReceiveShareSelection): string {
  const lines: string[] = ['MORGENDROT-SHARE']
  if (sel.includeWallet && sel.walletAddress?.trim()) {
    lines.push(`Wallet: ${sel.walletAddress.trim()}`)
  }
  for (const mb of sel.mailboxes) {
    const id = mb.id.trim()
    if (!id) continue
    const lab = (mb.label || 'Mailbox').trim() || 'Mailbox'
    lines.push(`Mailbox ${lab}: ${id}`)
  }
  if (sel.includeContact) {
    const name = (sel.contactName || '').trim()
    const tel = (sel.contactPhone || '').trim()
    const note = (sel.contactNote || '').trim()
    if (name) lines.push(`Name: ${name}`)
    if (tel) lines.push(`Tel: ${tel}`)
    if (note) lines.push(`Notiz: ${note}`)
  }
  if (lines.length <= 1) return ''
  return lines.join('\n')
}
