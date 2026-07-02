'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import { readMyPrivateMailboxes } from '@/frontend/lib/my-private-mailbox-store'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type BossWizardMailboxRow = {
  id: string
  masked: string
  label?: string
  source: 'server' | 'team-server' | 'local-private' | 'local-team'
}

export type BossWizardMailboxesContext = {
  serverPrivateId: string
  handoffLabel: string
  teamFromServer: BossWizardMailboxRow[]
  localPrivate: BossWizardMailboxRow[]
  localTeam: BossWizardMailboxRow[]
  hasServerPrivate: boolean
  hasTeamMailbox: boolean
  allRows: BossWizardMailboxRow[]
}

function row(id: string, source: BossWizardMailboxRow['source'], label?: string): BossWizardMailboxRow {
  const t = id.trim()
  return { id: t, masked: maskWalletAddress(t), label, source }
}

export function buildBossWizardMailboxesContext(api?: ApiStatus | null): BossWizardMailboxesContext {
  const serverPrivateId = (api?.mailboxId ?? '').trim()
  const serverPrivateLower = serverPrivateId.toLowerCase()
  const union = (api?.inboxUnionMailboxIds ?? []).map((id) => id.trim()).filter((id) => HEX64.test(id))

  const teamFromServer = union
    .filter((id) => id.toLowerCase() !== serverPrivateLower)
    .map((id) => row(id, 'team-server'))

  const localPrivate = readMyPrivateMailboxes()
    .filter((e) => e.objectId.trim().toLowerCase() !== serverPrivateLower)
    .map((e) => row(e.objectId, 'local-private', e.label))

  const localTeam = readMyTeamMailboxes().map((e) => row(e.objectId, 'local-team', e.label))

  const seen = new Set<string>()
  const allRows: BossWizardMailboxRow[] = []
  const push = (r: BossWizardMailboxRow) => {
    const k = r.id.toLowerCase()
    if (!HEX64.test(k) || seen.has(k)) return
    seen.add(k)
    allRows.push(r)
  }

  if (HEX64.test(serverPrivateId)) push(row(serverPrivateId, 'server'))
  teamFromServer.forEach(push)
  localPrivate.forEach(push)
  localTeam.forEach(push)

  const hasTeamMailbox = teamFromServer.length > 0 || localTeam.length > 0

  return {
    serverPrivateId,
    handoffLabel: (api?.handoffLabel ?? '').trim(),
    teamFromServer,
    localPrivate,
    localTeam,
    hasServerPrivate: HEX64.test(serverPrivateId),
    hasTeamMailbox,
    allRows,
  }
}

export function sourceLabel(source: BossWizardMailboxRow['source']): string {
  switch (source) {
    case 'server':
      return 'Server (MAILBOX_ID)'
    case 'team-server':
      return 'Team (Server-Union)'
    case 'local-private':
      return 'Privat (dieses Gerät)'
    case 'local-team':
      return 'Team (dieses Gerät)'
    default:
      return source
  }
}
