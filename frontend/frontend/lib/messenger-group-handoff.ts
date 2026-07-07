/**
 * M2c: Gruppe + Team-Mailbox per Handoff-ZIP verteilen (Boss → Helfer, ohne manuelle Object-ID).
 */
import {
  createMessengerGroupId,
  getActiveMessengerGroup,
  readMessengerGroups,
  normalizeGroupMemberAddress,
  upsertMessengerGroup,
  writeActiveGroupId,
  type MessengerGroupDefinition,
} from '@/frontend/lib/messenger-group-store'
import { addMyTeamMailbox } from '@/frontend/lib/my-team-mailbox-store'

export type MessengerGroupHandoffPayload = {
  name: string
  teamMailboxObjectId: string
  memberAddresses: string[]
  useTeamBroadcast?: boolean
}

const ENV_KEY = 'MESSENGER_GROUP_HANDOFF'

export function serializeMessengerGroupHandoff(payload: MessengerGroupHandoffPayload): string {
  return JSON.stringify({
    name: payload.name.trim(),
    teamMailboxObjectId: payload.teamMailboxObjectId.trim().toLowerCase(),
    memberAddresses: payload.memberAddresses.map((a) => a.trim().toLowerCase()),
    useTeamBroadcast: payload.useTeamBroadcast !== false,
  })
}

export function parseMessengerGroupHandoff(raw: string | undefined): MessengerGroupHandoffPayload | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    const name = String(j.name ?? '').trim()
    const teamMailboxObjectId = String(j.teamMailboxObjectId ?? '').trim().toLowerCase()
    const membersRaw = Array.isArray(j.memberAddresses) ? j.memberAddresses : []
    const memberAddresses = [
      ...new Set(
        membersRaw
          .map((m) => (typeof m === 'string' ? normalizeGroupMemberAddress(m) : null))
          .filter((m): m is string => !!m)
      ),
    ]
    if (!name || !/^0x[a-f0-9]{64}$/.test(teamMailboxObjectId) || memberAddresses.length === 0) {
      return null
    }
    return {
      name,
      teamMailboxObjectId,
      memberAddresses,
      useTeamBroadcast: j.useTeamBroadcast !== false,
    }
  } catch {
    return null
  }
}

/** Boss-Export: aktive Gruppe oder aus Bezeichnung + Team-MB + Partnern bauen. */
export function buildMessengerGroupHandoffForExport(p: {
  handoffLabel: string
  teamMailboxObjectId?: string
  memberAddresses: string[]
}): MessengerGroupHandoffPayload | null {
  const teamMb = p.teamMailboxObjectId?.trim().toLowerCase() ?? ''
  if (!/^0x[a-f0-9]{64}$/.test(teamMb)) return null
  const members = [
    ...new Set(
      p.memberAddresses
        .map((a) => normalizeGroupMemberAddress(a))
        .filter((m): m is string => !!m)
    ),
  ]
  if (members.length === 0) return null
  const name = p.handoffLabel.trim() || `Einsatzgruppe (${members.length})`
  return {
    name,
    teamMailboxObjectId: teamMb,
    memberAddresses: members,
    useTeamBroadcast: true,
  }
}

/** Nach Handoff-Import: Gruppe + Team-Mailbox lokal anlegen. */
export function applyMessengerGroupHandoffFromEnv(env: Record<string, string>): MessengerGroupDefinition | null {
  const payload = parseMessengerGroupHandoff(env[ENV_KEY])
  if (!payload) return null

  addMyTeamMailbox({
    objectId: payload.teamMailboxObjectId,
    label: payload.name,
    joinedAtMs: Date.now(),
  })

  const id = createMessengerGroupId()
  const def: MessengerGroupDefinition = {
    id,
    name: payload.name,
    memberAddresses: payload.memberAddresses,
    teamMailboxObjectId: payload.teamMailboxObjectId,
    ...(payload.useTeamBroadcast === false ? { useTeamBroadcast: false } : {}),
  }
  upsertMessengerGroup(def)
  writeActiveGroupId(id)
  return def
}

/** JSON für Handoff-.env — aktive Gruppe oder aus Export-Kontext. */
export function resolveMessengerGroupHandoffJson(p: {
  handoffLabel: string
  teamMailboxObjectId?: string
  memberAddresses: string[]
  /** Explizite Gruppe statt nur aktive Gruppe */
  messengerGroupId?: string
}): string | undefined {
  if (p.messengerGroupId) {
    const group = readMessengerGroups().find((g) => g.id === p.messengerGroupId)
    if (group?.teamMailboxObjectId) {
      const merged = [
        ...new Set([
          ...group.memberAddresses,
          ...p.memberAddresses
            .map((a) => normalizeGroupMemberAddress(a))
            .filter((m): m is string => !!m),
        ]),
      ]
      if (merged.length > 0) {
        return serializeMessengerGroupHandoff({
          name: group.name,
          teamMailboxObjectId: group.teamMailboxObjectId,
          memberAddresses: merged,
          useTeamBroadcast: group.useTeamBroadcast !== false,
        })
      }
    }
  }
  const active = getActiveMessengerGroup()
  if (active?.teamMailboxObjectId && active.memberAddresses.length) {
    return serializeMessengerGroupHandoff({
      name: active.name,
      teamMailboxObjectId: active.teamMailboxObjectId,
      memberAddresses: active.memberAddresses,
      useTeamBroadcast: active.useTeamBroadcast !== false,
    })
  }
  const built = buildMessengerGroupHandoffForExport(p)
  return built ? serializeMessengerGroupHandoff(built) : undefined
}

export { ENV_KEY as MESSENGER_GROUP_HANDOFF_ENV_KEY }
