'use client'

import type { Message } from '@/frontend/lib/types'

export type TeamSyncReceiveChannel = 'lan' | 'iota'

export function collectTeamSyncReceiveChannels(msg: Message): Set<TeamSyncReceiveChannel> {
  const via = new Set<TeamSyncReceiveChannel>()
  if (msg.source === 'lan' || msg.transports?.includes('lan')) via.add('lan')
  if (
    msg.source === 'mailbox' ||
    msg.source === undefined ||
    msg.transports?.includes('internet')
  ) {
    via.add('iota')
  }
  return via
}

export function formatTeamSyncReceivedVia(via: ReadonlySet<TeamSyncReceiveChannel>): string {
  const parts: string[] = []
  if (via.has('lan')) parts.push('LAN')
  if (via.has('iota')) parts.push('IOTA (Mailbox)')
  if (!parts.length) return ''
  return `Empfangen über: ${parts.join(' · ')}`
}
