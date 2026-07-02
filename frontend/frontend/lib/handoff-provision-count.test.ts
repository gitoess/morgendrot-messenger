import { describe, expect, it, vi } from 'vitest'
import {
  bossProvisionedHelpersLabel,
  countBossProvisionedHelpers,
} from '@/frontend/lib/handoff-provision-count'

vi.mock('@/frontend/lib/boss-provision-registry', () => ({
  isBossProvisionRegistryUnlocked: () => true,
  getBossProvisionRegistryEntries: () => [{ id: '1' }, { id: '2' }],
  countBossProvisionRegistryByStatus: (entries: unknown[]) => ({
    total: entries.length,
    open: 0,
    seedShown: 0,
    handedOver: 0,
  }),
}))

vi.mock('@/frontend/lib/team-roster-wire', () => ({
  listTeamRosterWalletContacts: () => [],
}))

describe('handoff-provision-count', () => {
  it('zählt Registry-Einträge wenn entsperrt', () => {
    expect(countBossProvisionedHelpers(null, {})).toBe(2)
  })

  it('formatiert Helfer-Label', () => {
    expect(bossProvisionedHelpersLabel(0)).toMatch(/Noch keine/)
    expect(bossProvisionedHelpersLabel(1)).toBe('1 Helfer provisioniert')
    expect(bossProvisionedHelpersLabel(3)).toBe('3 Helfer provisioniert')
  })
})
