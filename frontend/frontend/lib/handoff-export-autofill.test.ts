import { describe, expect, it } from 'vitest'
import {
  buildDefaultPartnerAddresses,
  buildTeamMailboxOptions,
  defaultSelectedTeamMailboxIds,
  formatTeamMailboxIds,
  pickPrimaryMailboxId,
} from './handoff-export-autofill'

const A = '0x' + 'a'.repeat(64)
const B = '0x' + 'b'.repeat(64)
const C = '0x' + 'c'.repeat(64)

describe('handoff-export-autofill', () => {
  it('merge server und lokale Team-Mailboxen ohne Duplikate', () => {
    const opts = buildTeamMailboxOptions(
      { mailboxId: A } as never,
      [{ objectId: A, label: 'Dup' }, { objectId: B, label: 'Alpha' }]
    )
    expect(opts).toHaveLength(2)
    expect(opts.map((o) => o.id)).toEqual([A, B])
  })

  it('Partner ohne Boss-Adresse', () => {
    const partners = buildDefaultPartnerAddresses(
      { myAddressFull: A, connectedAddresses: [B, C] } as never,
      { [C]: {} as never },
      A
    )
    expect(partners.split(',').map((s) => s.trim()).sort()).toEqual([B, C].sort())
  })

  it('pickPrimaryMailboxId und formatTeamMailboxIds', () => {
    expect(pickPrimaryMailboxId([B, C])).toBe(B)
    expect(formatTeamMailboxIds([B, 'invalid', C])).toBe(`${B},${C}`)
    expect(defaultSelectedTeamMailboxIds([{ id: B, label: 'x', source: 'local' }])).toEqual([B])
  })
})
