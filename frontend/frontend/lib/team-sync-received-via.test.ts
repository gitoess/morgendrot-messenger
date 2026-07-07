import { describe, expect, it } from 'vitest'
import {
  collectTeamSyncReceiveChannels,
  formatTeamSyncReceivedVia,
} from '@/frontend/lib/team-sync-received-via'
import type { Message } from '@/frontend/lib/types'
import { formatTeamWireDeliveryChannels } from '@/frontend/lib/team-roster-wire'

describe('team-sync-received-via', () => {
  it('formatTeamSyncReceivedVia für LAN und IOTA', () => {
    expect(formatTeamSyncReceivedVia(new Set(['lan']))).toBe('Empfangen über: LAN')
    expect(formatTeamSyncReceivedVia(new Set(['iota']))).toBe('Empfangen über: IOTA (Mailbox)')
    expect(formatTeamSyncReceivedVia(new Set(['lan', 'iota']))).toBe(
      'Empfangen über: LAN · IOTA (Mailbox)'
    )
  })

  it('collectTeamSyncReceiveChannels erkennt LAN und Mailbox', () => {
    const lan: Message = {
      id: 'l1',
      from: '0x1',
      content: 'x',
      timestamp: 1,
      source: 'lan',
      transports: ['lan'],
    }
    const iota: Message = {
      id: 'i1',
      from: '0x1',
      content: 'x',
      timestamp: 1,
      source: 'mailbox',
      transports: ['internet'],
    }
    expect([...collectTeamSyncReceiveChannels(lan)]).toEqual(['lan'])
    expect([...collectTeamSyncReceiveChannels(iota)]).toEqual(['iota'])
  })
})

describe('formatTeamWireDeliveryChannels', () => {
  it('nutzt Spec-Format mit Häkchen', () => {
    expect(formatTeamWireDeliveryChannels({ lan: true, iota: true, meshPing: true })).toBe(
      ' — Zugestellt: Lokales Netz ✓ · IOTA ✓ · Funk-Hinweis ✓'
    )
  })
})
