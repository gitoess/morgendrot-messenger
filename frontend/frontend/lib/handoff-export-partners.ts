import type { ApiStatus } from '@/frontend/lib/api'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import { parsePartnerAddressCsv } from '@/frontend/lib/handoff-export-display'

const ADDR = /^0x[a-fA-F0-9]{64}$/i

export type HandoffPartnerOption = {
  address: string
  label: string
  /** connected = Handshake; phonebook = Telefonbuch */
  source: 'connected' | 'phonebook'
}

function normAddr(raw?: string): string {
  const t = (raw || '').trim()
  return ADDR.test(t) ? t : ''
}

/** Partner zur Auswahl — mit lesbarem Namen aus Telefonbuch. */
export function buildHandoffPartnerOptions(
  apiSnapshot: ApiStatus | null | undefined,
  contactDirectory: Record<string, ContactMeshEntryClient> | undefined,
  bossAddress?: string
): HandoffPartnerOption[] {
  const boss = normAddr(bossAddress || apiSnapshot?.myAddressFull || apiSnapshot?.myAddress)
  const byAddr = new Map<string, HandoffPartnerOption>()

  for (const [addr, entry] of Object.entries(contactDirectory ?? {})) {
    const n = normAddr(addr)
    if (!n || n === boss) continue
    const tags = entry.roleTags?.filter(Boolean).join(', ')
    const base = (entry.label || '').trim() || 'Kontakt'
    const label = tags ? `${base} (${tags})` : base
    byAddr.set(n.toLowerCase(), { address: n, label, source: 'phonebook' })
  }

  for (const a of apiSnapshot?.connectedAddresses ?? []) {
    const n = normAddr(a)
    if (!n || n === boss) continue
    const key = n.toLowerCase()
    if (!byAddr.has(key)) {
      byAddr.set(key, { address: n, label: 'Partner (verbunden)', source: 'connected' })
    }
  }

  return Array.from(byAddr.values()).sort((a, b) => a.label.localeCompare(b.label, 'de'))
}

export function defaultSelectedPartnerAddresses(options: HandoffPartnerOption[]): string[] {
  return options.map((o) => o.address)
}

export function partnerAddressesToCsv(addresses: Iterable<string>): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of addresses) {
    const n = normAddr(raw)
    if (!n || seen.has(n.toLowerCase())) continue
    seen.add(n.toLowerCase())
    out.push(n)
  }
  return out.join(', ')
}

export { parsePartnerAddressCsv }
