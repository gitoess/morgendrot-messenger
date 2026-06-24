'use client'

import type { TeamMemberWireMember } from '@/frontend/lib/morg-team-member-update-v1'

const STORAGE_KEY = 'morgendrot.teamRosterPending.v1'
export const TEAM_ROSTER_PENDING_CHANGED_EVENT = 'morgendrot:team-roster-pending-changed'

export type RosterPendingSource = 'handoff'

export type RosterPendingSuggestion = {
  id: string
  source: RosterPendingSource
  member: TeamMemberWireMember
  createdAt: number
  handoffLabel?: string
  registryEntryId?: string
}

type StoreShape = {
  suggestions: RosterPendingSuggestion[]
}

function readStore(): StoreShape {
  if (typeof window === 'undefined') return { suggestions: [] }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { suggestions: [] }
    const parsed = JSON.parse(raw) as StoreShape
    if (!Array.isArray(parsed?.suggestions)) return { suggestions: [] }
    return { suggestions: parsed.suggestions }
  } catch {
    return { suggestions: [] }
  }
}

function writeStore(store: StoreShape): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  window.dispatchEvent(new CustomEvent(TEAM_ROSTER_PENDING_CHANGED_EVENT))
}

function newId(): string {
  return `rp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function listRosterPendingSuggestions(): RosterPendingSuggestion[] {
  return readStore()
    .suggestions.filter((s) => s.member?.address?.trim())
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function enqueueRosterPendingSuggestion(input: {
  id?: string
  source: RosterPendingSource
  member: TeamMemberWireMember
  handoffLabel?: string
  registryEntryId?: string
}): RosterPendingSuggestion {
  const addr = input.member.address.trim().toLowerCase()
  const store = readStore()
  const existingIdx = store.suggestions.findIndex((s) => s.member.address.trim().toLowerCase() === addr)
  const entry: RosterPendingSuggestion = {
    id: input.id?.trim() || (existingIdx >= 0 ? store.suggestions[existingIdx].id : newId()),
    source: input.source,
    member: input.member,
    createdAt: Date.now(),
    handoffLabel: input.handoffLabel?.trim() || undefined,
    registryEntryId: input.registryEntryId,
  }
  if (existingIdx >= 0) {
    store.suggestions[existingIdx] = entry
  } else {
    store.suggestions.unshift(entry)
  }
  writeStore(store)
  return entry
}

export function removeRosterPendingSuggestion(id: string): void {
  const store = readStore()
  store.suggestions = store.suggestions.filter((s) => s.id !== id)
  writeStore(store)
}
