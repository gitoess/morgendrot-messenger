import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createHandoffMessengerGroup } from './create-handoff-messenger-group'
import { readMessengerGroups, readActiveGroupId } from './messenger-group-store'
import { readMyTeamMailboxes } from './my-team-mailbox-store'

describe('createHandoffMessengerGroup', () => {
  const store: Record<string, string> = {}
  const boss = '0x' + 'b'.repeat(64)
  const teamMb = '0x' + 'c'.repeat(64)

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      },
    } as unknown as Window & typeof globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('legt Gruppe mit Boss und Team-Postfach an', () => {
    const r = createHandoffMessengerGroup({
      name: 'Alpha',
      memberAddresses: [boss],
      teamMailboxObjectId: teamMb,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const groups = readMessengerGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0]?.name).toBe('Alpha')
    expect(groups[0]?.teamMailboxObjectId).toBe(teamMb.toLowerCase())
    expect(readActiveGroupId()).toBe(r.groupId)
    expect(readMyTeamMailboxes().some((t) => t.objectId.toLowerCase() === teamMb.toLowerCase())).toBe(true)
  })

  it('lehnt leeren Namen ab', () => {
    const r = createHandoffMessengerGroup({ name: '  ', memberAddresses: [boss] })
    expect(r.ok).toBe(false)
  })
})
