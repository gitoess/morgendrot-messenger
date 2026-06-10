import { describe, expect, it } from 'vitest'
import {
  buildMessengerGroupHandoffForExport,
  parseMessengerGroupHandoff,
  serializeMessengerGroupHandoff,
} from '@/frontend/lib/messenger-group-handoff'

const MB = '0x' + 'a'.repeat(64)
const BOSS = '0x' + 'b'.repeat(64)
const HELPER = '0x' + 'c'.repeat(64)

describe('messenger-group-handoff', () => {
  it('roundtrip serialize/parse', () => {
    const raw = serializeMessengerGroupHandoff({
      name: 'Alpha',
      teamMailboxObjectId: MB,
      memberAddresses: [BOSS, HELPER],
    })
    const p = parseMessengerGroupHandoff(raw)
    expect(p?.name).toBe('Alpha')
    expect(p?.teamMailboxObjectId).toBe(MB.toLowerCase())
    expect(p?.memberAddresses).toEqual([BOSS.toLowerCase(), HELPER.toLowerCase()])
  })

  it('buildMessengerGroupHandoffForExport', () => {
    const p = buildMessengerGroupHandoffForExport({
      handoffLabel: 'Einsatz Nord',
      teamMailboxObjectId: MB,
      memberAddresses: [BOSS, HELPER, 'invalid'],
    })
    expect(p?.name).toBe('Einsatz Nord')
    expect(p?.memberAddresses.length).toBe(2)
  })
})
