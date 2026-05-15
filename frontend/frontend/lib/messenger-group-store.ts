/**
 * M2a: lokale Gruppen-Definition (Mitgliederliste 0x…) — kein Move-Gruppenobjekt.
 */

export type MessengerGroupDefinition = {
  id: string
  name: string
  memberAddresses: string[]
  /** M2b: optionaler Streams-Anchor für Live-Hinweise (Archiv bleibt Mailbox). */
  streamsAnchorId?: string
}

const LS_GROUPS = 'morgendrot.messenger.groups.v1'
const LS_ACTIVE = 'morgendrot.messenger.activeGroupId.v1'

export function normalizeGroupMemberAddress(raw: string): string | null {
  const t = raw.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(t)) return null
  return t.toLowerCase()
}

function parseGroups(raw: string | null): MessengerGroupDefinition[] {
  if (!raw) return []
  try {
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j)) return []
    const out: MessengerGroupDefinition[] = []
    for (const row of j) {
      if (!row || typeof row !== 'object') continue
      const o = row as Record<string, unknown>
      const id = String(o.id ?? '').trim()
      const name = String(o.name ?? '').trim()
      const membersRaw = Array.isArray(o.memberAddresses) ? o.memberAddresses : []
      const memberAddresses = [
        ...new Set(
          membersRaw
            .map((m) => (typeof m === 'string' ? normalizeGroupMemberAddress(m) : null))
            .filter((m): m is string => !!m)
        ),
      ]
      const streamsAnchorId =
        typeof o.streamsAnchorId === 'string' && /^0x[a-fA-F0-9]{64}$/i.test(o.streamsAnchorId.trim())
          ? o.streamsAnchorId.trim()
          : undefined
      if (!id || memberAddresses.length === 0) continue
      out.push({
        id,
        name: name || `Gruppe (${memberAddresses.length})`,
        memberAddresses,
        ...(streamsAnchorId ? { streamsAnchorId } : {}),
      })
    }
    return out
  } catch {
    return []
  }
}

export function readMessengerGroups(): MessengerGroupDefinition[] {
  if (typeof window === 'undefined') return []
  return parseGroups(window.localStorage.getItem(LS_GROUPS))
}

export function writeMessengerGroups(groups: MessengerGroupDefinition[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_GROUPS, JSON.stringify(groups))
}

export function readActiveGroupId(): string | null {
  if (typeof window === 'undefined') return null
  const id = window.localStorage.getItem(LS_ACTIVE)?.trim()
  return id || null
}

export function writeActiveGroupId(id: string | null): void {
  if (typeof window === 'undefined') return
  if (!id?.trim()) window.localStorage.removeItem(LS_ACTIVE)
  else window.localStorage.setItem(LS_ACTIVE, id.trim())
}

export function getActiveMessengerGroup(): MessengerGroupDefinition | null {
  const id = readActiveGroupId()
  if (!id) return null
  return readMessengerGroups().find((g) => g.id === id) ?? null
}

export function createMessengerGroupId(): string {
  return `grp-${Date.now().toString(36)}`
}

export function upsertMessengerGroup(def: MessengerGroupDefinition): void {
  const groups = readMessengerGroups()
  const i = groups.findIndex((g) => g.id === def.id)
  const next = [...groups]
  if (i >= 0) next[i] = def
  else next.push(def)
  writeMessengerGroups(next)
}

export function deleteMessengerGroup(id: string): void {
  writeMessengerGroups(readMessengerGroups().filter((g) => g.id !== id))
  if (readActiveGroupId() === id) writeActiveGroupId(null)
}

/** Komma-/Zeilen-getrennte 0x-Adressen → normalisierte Liste. */
export function parseGroupMemberInput(text: string): string[] {
  const parts = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    const n = normalizeGroupMemberAddress(p)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}
