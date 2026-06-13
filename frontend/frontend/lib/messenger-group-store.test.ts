import { describe, expect, it, beforeEach } from 'vitest'
import {
  createMessengerGroupId,
  parseGroupMemberInput,
  formatGroupMembersDisplay,
  readMessengerGroups,
  upsertMessengerGroup,
  writeActiveGroupId,
  getActiveMessengerGroup,
  deleteMessengerGroup,
} from '@/frontend/lib/messenger-group-store'

describe('messenger-group-store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('parseGroupMemberInput resolves phonebook labels', () => {
    const a = '0x' + 'a'.repeat(64)
    const directory = {
      [a]: { label: 'Anna Einsatz', address: a },
    } as Record<string, { label: string; address: string }>
    expect(parseGroupMemberInput('Anna Einsatz', directory)).toEqual([a.toLowerCase()])
    expect(formatGroupMembersDisplay(directory, [a])).toBe('Anna Einsatz')
  })

  it('parseGroupMemberInput supports names with spaces per line', () => {
    const a = '0x' + 'c'.repeat(64)
    const directory = {
      [a]: { label: 'Team Alpha', address: a },
    } as Record<string, { label: string; address: string }>
    expect(parseGroupMemberInput('Team Alpha\n', directory)).toEqual([a.toLowerCase()])
  })

  it('parseGroupMemberInput deduplicates', () => {
    const a = '0x' + 'a'.repeat(64)
    const b = '0x' + 'b'.repeat(64)
    const list = parseGroupMemberInput(`${a}, ${b}\n${a}`)
    expect(list).toHaveLength(2)
    expect(list[0]).toBe(a.toLowerCase())
  })

  it('upsert and active group', () => {
    const id = createMessengerGroupId()
    const m1 = '0x' + '1'.repeat(64)
    const m2 = '0x' + '2'.repeat(64)
    upsertMessengerGroup({ id, name: 'Team', memberAddresses: [m1, m2] })
    writeActiveGroupId(id)
    expect(readMessengerGroups()).toHaveLength(1)
    expect(getActiveMessengerGroup()?.name).toBe('Team')
    deleteMessengerGroup(id)
    expect(getActiveMessengerGroup()).toBeNull()
  })

  it('persists optional secondary channel metadata', () => {
    const id = createMessengerGroupId()
    const m1 = '0x' + '1'.repeat(64)
    upsertMessengerGroup({
      id,
      name: 'Team Funk',
      memberAddresses: [m1],
      secondaryChannel: {
        channelIndex: 3,
        channelName: 'Einsatz-Alpha',
        pskRef: 'handoff:alpha-2026',
      },
    })
    const loaded = readMessengerGroups()[0]
    expect(loaded?.secondaryChannel?.channelIndex).toBe(3)
    expect(loaded?.secondaryChannel?.channelName).toBe('Einsatz-Alpha')
    expect(loaded?.secondaryChannel?.pskRef).toBe('handoff:alpha-2026')
  })
})
