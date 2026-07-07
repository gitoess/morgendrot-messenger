import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  addMemberToMessengerGroup,
  assignProvisionHelperMessengerGroup,
  findMessengerGroupById,
} from './provision-helper-messenger-group'
import {
  __resetBossProvisionRegistryForTests,
  addBossProvisionRegistryEntry,
  initializeBossProvisionRegistry,
  unlockBossProvisionRegistry,
  getBossProvisionRegistryEntries,
} from './boss-provision-registry'
import { upsertMessengerGroup, writeMessengerGroups } from './messenger-group-store'

describe('provision-helper-messenger-group', () => {
  const store: Record<string, string> = {}
  const helper = '0x' + 'a'.repeat(64)
  const boss = '0x' + 'b'.repeat(64)

  beforeEach(() => {
    __resetBossProvisionRegistryForTests()
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
      crypto: globalThis.crypto,
    } as unknown as Window & typeof globalThis)
    writeMessengerGroups([
      {
        id: 'grp-test',
        name: 'Alpha',
        memberAddresses: [boss],
        teamMailboxObjectId: '0x' + 'c'.repeat(64),
      },
    ])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetBossProvisionRegistryForTests()
  })

  it('fügt Helfer zur Gruppe hinzu', () => {
    expect(addMemberToMessengerGroup('grp-test', helper)).toBe(true)
    const g = findMessengerGroupById('grp-test')
    expect(g?.memberAddresses).toContain(helper.toLowerCase())
  })

  it('speichert messengerGroupId in Registry', async () => {
    await initializeBossProvisionRegistry('test-master-12', 'test-master-12')
    const added = await addBossProvisionRegistryEntry({
      label: 'Medic',
      presetId: 'helfer',
      address: helper,
      seedImport: 'word '.repeat(12),
      masterPassword: 'test-master-12',
    })
    expect(added.ok).toBe(true)
    const entryId = added.ok ? added.entry.id : ''
    const r = await assignProvisionHelperMessengerGroup({
      entryId,
      groupId: 'grp-test',
      helperAddress: helper,
    })
    expect(r.ok).toBe(true)
    expect(getBossProvisionRegistryEntries()[0]?.messengerGroupId).toBe('grp-test')
  })
})
