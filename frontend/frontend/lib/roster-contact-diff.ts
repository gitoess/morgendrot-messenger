'use client'

import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import type { TeamMemberWireMember } from '@/frontend/lib/morg-team-member-update-v1'

export type RosterDiffFieldKey =
  | 'label'
  | 'roleTags'
  | 'meshNodeId'
  | 'telegramChatId'

export type RosterFieldDiff = {
  key: RosterDiffFieldKey
  label: string
  before?: string
  after?: string
  status: 'new' | 'changed' | 'unchanged' | 'conflict'
}

export type RosterContactDiffSummary = {
  status: 'new' | 'update' | 'unchanged' | 'conflict'
  fields: RosterFieldDiff[]
}

const FIELD_LABELS: Record<RosterDiffFieldKey, string> = {
  label: 'Name',
  roleTags: 'Rollen-Tags',
  meshNodeId: 'Funk (Node-ID)',
  telegramChatId: 'Telegram',
}

function normAddr(a: string): string {
  return (a || '').trim().toLowerCase()
}

function fmtTags(tags?: string[]): string | undefined {
  if (!tags?.length) return undefined
  return tags.join(', ')
}

function compareScalar(
  key: RosterDiffFieldKey,
  beforeRaw: string | undefined,
  afterRaw: string | undefined
): RosterFieldDiff {
  const before = beforeRaw?.trim() || undefined
  const after = afterRaw?.trim() || undefined
  if (!before && after) {
    return { key, label: FIELD_LABELS[key], after, status: 'new' }
  }
  if (before && !after) {
    return { key, label: FIELD_LABELS[key], before, status: 'unchanged' }
  }
  if (!before && !after) {
    return { key, label: FIELD_LABELS[key], status: 'unchanged' }
  }
  if (before === after) {
    return { key, label: FIELD_LABELS[key], before, after, status: 'unchanged' }
  }
  return { key, label: FIELD_LABELS[key], before, after, status: 'conflict' }
}

/** Vergleicht Roster-Vorschlag (Beitritt/Handoff) mit bestehendem Boss-Telefonbuch-Eintrag. */
export function computeRosterContactDiff(
  existing: ContactMeshEntryClient | undefined,
  proposed: TeamMemberWireMember
): RosterContactDiffSummary {
  const fields: RosterFieldDiff[] = [
    compareScalar('label', existing?.label, proposed.name),
    compareScalar('roleTags', fmtTags(existing?.roleTags), fmtTags(proposed.roleTags)),
    compareScalar('meshNodeId', existing?.meshNodeId, proposed.meshNodeId),
    compareScalar('telegramChatId', existing?.telegramChatId, proposed.telegramChatId),
  ].filter((f) => f.status !== 'unchanged' || f.key === 'label')

  const visible = fields.filter((f) => f.status !== 'unchanged')
  if (!existing) {
    return { status: 'new', fields: visible.length ? visible : fields.slice(0, 1) }
  }

  const hasConflict = visible.some((f) => f.status === 'conflict')
  if (hasConflict) return { status: 'conflict', fields: visible }
  if (visible.some((f) => f.status === 'new' || f.status === 'changed')) {
    return { status: 'update', fields: visible }
  }
  return { status: 'unchanged', fields: [] }
}

export function rosterDiffHeadline(summary: RosterContactDiffSummary): string {
  switch (summary.status) {
    case 'new':
      return 'Neu im Roster'
    case 'update':
      return 'Geändert'
    case 'conflict':
      return 'Konflikt — prüfen'
    default:
      return 'Unverändert'
  }
}

export function findDirectoryEntry(
  directory: Record<string, ContactMeshEntryClient>,
  address: string
): ContactMeshEntryClient | undefined {
  return directory[normAddr(address)]
}
