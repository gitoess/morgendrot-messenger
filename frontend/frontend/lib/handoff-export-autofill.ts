import type { ApiStatus } from '@/frontend/lib/api'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import type { MyTeamMailboxEntry } from '@/frontend/lib/my-team-mailbox-store'

const ADDR = /^0x[a-fA-F0-9]{64}$/i

export type TeamMailboxOption = {
  id: string
  label: string
  source: 'server' | 'local'
}

function normAddr(raw?: string): string {
  const t = (raw || '').trim()
  return ADDR.test(t) ? t : ''
}

/** Team-Mailboxen aus Server-.env und lokalem Store zusammenführen. */
export function buildTeamMailboxOptions(
  apiSnapshot: ApiStatus | null | undefined,
  localTeams: MyTeamMailboxEntry[]
): TeamMailboxOption[] {
  const out: TeamMailboxOption[] = []
  const seen = new Set<string>()

  const serverId = normAddr(apiSnapshot?.mailboxId)
  if (serverId && !seen.has(serverId)) {
    seen.add(serverId)
    out.push({ id: serverId, label: 'Server Einsatz-Mailbox', source: 'server' })
  }

  for (const entry of localTeams) {
    const id = normAddr(entry.objectId)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const label = entry.label?.trim() || `Team ${id.slice(0, 10)}…`
    out.push({ id, label, source: 'local' })
  }

  return out
}

/** Standard: alle bekannten Team-Mailboxen vorauswählen. */
export function defaultSelectedTeamMailboxIds(options: TeamMailboxOption[]): string[] {
  return options.map((o) => o.id)
}

/** Partner-Adressen aus verbundenen Kontakten und Telefonbuch (ohne eigene Boss-Adresse). */
export function buildDefaultPartnerAddresses(
  apiSnapshot: ApiStatus | null | undefined,
  contactDirectory: Record<string, ContactMeshEntryClient> | undefined,
  bossAddress?: string
): string {
  const boss = normAddr(bossAddress || apiSnapshot?.myAddressFull || apiSnapshot?.myAddress)
  const set = new Set<string>()
  for (const a of apiSnapshot?.connectedAddresses ?? []) {
    const n = normAddr(a)
    if (n && n !== boss) set.add(n)
  }
  for (const addr of Object.keys(contactDirectory ?? {})) {
    const n = normAddr(addr)
    if (n && n !== boss) set.add(n)
  }
  return Array.from(set).join(', ')
}

export function pickPrimaryMailboxId(selectedIds: string[]): string | undefined {
  for (const id of selectedIds) {
    const n = normAddr(id)
    if (n) return n
  }
  return undefined
}

export function formatTeamMailboxIds(selectedIds: string[]): string | undefined {
  const ids = selectedIds.map((id) => normAddr(id)).filter(Boolean)
  if (!ids.length) return undefined
  return ids.join(',')
}
