import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  buildMessengerGroupHandoffForExport,
  parseMessengerGroupHandoff,
  resolveMessengerGroupHandoffJson,
  serializeMessengerGroupHandoff,
} from '@/frontend/lib/messenger-group-handoff'
import { writeMessengerGroups } from '@/frontend/lib/messenger-group-store'

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

  it('resolveMessengerGroupHandoffJson mit expliziter Gruppe', () => {
    const store: Record<string, string> = {}
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
    writeMessengerGroups([
      {
        id: 'grp-1',
        name: 'Bravo',
        memberAddresses: [BOSS],
        teamMailboxObjectId: MB,
      },
    ])
    const raw = resolveMessengerGroupHandoffJson({
      handoffLabel: 'X',
      teamMailboxObjectId: MB,
      memberAddresses: [HELPER],
      messengerGroupId: 'grp-1',
    })
    expect(raw).toBeTruthy()
    const p = parseMessengerGroupHandoff(raw)
    expect(p?.name).toBe('Bravo')
    expect(p?.memberAddresses).toEqual([BOSS.toLowerCase(), HELPER.toLowerCase()])
    vi.unstubAllGlobals()
  })
})
