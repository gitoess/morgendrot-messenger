/**
 * M2a: lokale Gruppen-Definition (Mitgliederliste 0x…) — kein Move-Gruppenobjekt.
 */

import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel, lookupContactAddressByLabel } from '@/frontend/lib/contact-display'

export type MessengerGroupDefinition = {
  id: string
  name: string
  memberAddresses: string[]
  /** M2b: optionaler Streams-Anchor für Live-Hinweise (Archiv bleibt Mailbox). */
  streamsAnchorId?: string
  /** M2c: dedizierte Team-Mailbox für 1× Broadcast (Object-ID teilen). */
  teamMailboxObjectId?: string
  /** M2c: Team-Broadcast statt pairwise (Default true wenn teamMailboxObjectId gesetzt). */
  useTeamBroadcast?: boolean
  /** H.3o.6 Schritt 2: optionale Secondary-Channel-Metadaten (ohne PSK-Secret im Klartext). */
  secondaryChannel?: {
    channelIndex?: number
    channelName?: string
    pskRef?: string
  }
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
      const teamMailboxObjectId =
        typeof o.teamMailboxObjectId === 'string' && /^0x[a-fA-F0-9]{64}$/i.test(o.teamMailboxObjectId.trim())
          ? o.teamMailboxObjectId.trim().toLowerCase()
          : undefined
      const useTeamBroadcast = o.useTeamBroadcast === false ? false : teamMailboxObjectId ? true : undefined
      const rawSecondary = o.secondaryChannel
      const secondaryObj =
        rawSecondary && typeof rawSecondary === 'object' ? (rawSecondary as Record<string, unknown>) : null
      const channelIndexRaw = secondaryObj?.channelIndex
      const channelIndex =
        typeof channelIndexRaw === 'number' &&
        Number.isInteger(channelIndexRaw) &&
        channelIndexRaw >= 0 &&
        channelIndexRaw <= 7
          ? channelIndexRaw
          : undefined
      const channelName =
        typeof secondaryObj?.channelName === 'string' && secondaryObj.channelName.trim()
          ? secondaryObj.channelName.trim()
          : undefined
      const pskRef =
        typeof secondaryObj?.pskRef === 'string' && secondaryObj.pskRef.trim()
          ? secondaryObj.pskRef.trim()
          : undefined
      const secondaryChannel =
        channelIndex != null || channelName || pskRef
          ? {
              ...(channelIndex != null ? { channelIndex } : {}),
              ...(channelName ? { channelName } : {}),
              ...(pskRef ? { pskRef } : {}),
            }
          : undefined
      if (!id || memberAddresses.length === 0) continue
      out.push({
        id,
        name: name || `Gruppe (${memberAddresses.length})`,
        memberAddresses,
        ...(streamsAnchorId ? { streamsAnchorId } : {}),
        ...(teamMailboxObjectId ? { teamMailboxObjectId } : {}),
        ...(useTeamBroadcast === false ? { useTeamBroadcast: false } : {}),
        ...(secondaryChannel ? { secondaryChannel } : {}),
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

/** Anzeige in Gruppen-Editor: Alias aus Telefonbuch, sonst 0x-Adresse (je Zeile). */
export function formatGroupMembersDisplay(
  directory: Record<string, ContactMeshEntryClient>,
  addresses: string[]
): string {
  return addresses.map((a) => contactDisplayLabel(directory, a) || a).join('\n')
}

function tokenizeGroupMemberInput(text: string): string[] {
  const tokens: string[] = []
  for (const line of text.split(/\n/)) {
    const t = line.trim()
    if (!t) continue
    if (/[,;]/.test(t)) {
      tokens.push(...t.split(/[,;]+/).map((s) => s.trim()).filter(Boolean))
      continue
    }
    const addrMatches = t.match(/0x[a-fA-F0-9]{64}/g)
    if (addrMatches && addrMatches.length > 1 && /\s/.test(t)) {
      tokens.push(...addrMatches.map((s) => s.trim()))
      continue
    }
    tokens.push(t)
  }
  if (tokens.length === 0 && text.trim()) {
    tokens.push(...text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))
  }
  return tokens
}

function resolveGroupMemberToken(
  raw: string,
  directory?: Record<string, ContactMeshEntryClient>
): string | null {
  const direct = normalizeGroupMemberAddress(raw)
  if (direct) return direct
  if (!directory) return null
  return lookupContactAddressByLabel(directory, raw)
}

/** Zeilen/Komma: 0x-Adressen oder Telefonbuch-Namen → normalisierte Adressliste. */
export function parseGroupMemberInput(
  text: string,
  directory?: Record<string, ContactMeshEntryClient>
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of tokenizeGroupMemberInput(text)) {
    const n = resolveGroupMemberToken(p, directory)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}
