'use client'

import {
  createMessengerGroupId,
  normalizeGroupMemberAddress,
  upsertMessengerGroup,
  writeActiveGroupId,
} from '@/frontend/lib/messenger-group-store'
import { joinMyTeamMailbox } from '@/frontend/lib/my-team-mailbox-store'

export function createHandoffMessengerGroup(opts: {
  name: string
  memberAddresses: string[]
  teamMailboxObjectId?: string
  setActive?: boolean
}): { ok: true; groupId: string } | { ok: false; error: string } {
  const name = opts.name.trim()
  if (!name) return { ok: false, error: 'Gruppenname fehlt.' }

  const members = [
    ...new Set(
      opts.memberAddresses
        .map((a) => normalizeGroupMemberAddress(a))
        .filter((m): m is string => !!m)
    ),
  ]
  if (members.length === 0) {
    return { ok: false, error: 'Mindestens eine gültige Wallet-Adresse (0x + 64 Hex) nötig.' }
  }

  const teamMb = (opts.teamMailboxObjectId || '').trim().toLowerCase()
  const hasTeamMb = /^0x[a-f0-9]{64}$/.test(teamMb)

  if (hasTeamMb) {
    joinMyTeamMailbox(teamMb, name)
  }

  const groupId = createMessengerGroupId()
  upsertMessengerGroup({
    id: groupId,
    name,
    memberAddresses: members,
    ...(hasTeamMb ? { teamMailboxObjectId: teamMb, useTeamBroadcast: true } : {}),
  })

  if (opts.setActive !== false) {
    writeActiveGroupId(groupId)
  }

  return { ok: true, groupId }
}
