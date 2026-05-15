import { describe, expect, it, beforeEach } from 'vitest'
import {
  createMessengerGroupId,
  parseGroupMemberInput,
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
})
