import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetBossProvisionRegistryForTests,
  addBossProvisionRegistryEntry,
  getBossProvisionRegistryEntries,
  hasBossProvisionRegistry,
  initializeBossProvisionRegistry,
  isBossProvisionRegistryUnlocked,
  lockBossProvisionRegistry,
  revealBossProvisionSeed,
  unlockBossProvisionRegistry,
} from './boss-provision-registry'

describe('boss-provision-registry', () => {
  beforeEach(() => {
    __resetBossProvisionRegistryForTests()
  })

  it('initializes empty registry and stores encrypted seed', async () => {
    const init = await initializeBossProvisionRegistry('test-master-12', 'test-master-12')
    expect(init.ok).toBe(true)
    expect(hasBossProvisionRegistry()).toBe(true)
    expect(isBossProvisionRegistryUnlocked()).toBe(true)

    const added = await addBossProvisionRegistryEntry({
      label: 'Anna',
      presetId: 'helfer',
      address: '0x' + 'b'.repeat(64),
      seedImport: 'word '.repeat(12).trim(),
      masterPassword: 'test-master-12',
    })
    expect(added.ok).toBe(true)

    lockBossProvisionRegistry()
    expect(isBossProvisionRegistryUnlocked()).toBe(false)

    const unlock = await unlockBossProvisionRegistry('test-master-12')
    expect(unlock.ok).toBe(true)
    expect(getBossProvisionRegistryEntries()).toHaveLength(1)

    const entry = getBossProvisionRegistryEntries()[0]!
    const seed = await revealBossProvisionSeed(entry, 'test-master-12')
    expect(seed.ok).toBe(true)
    if (seed.ok) expect(seed.seedImport.split(/\s+/).length).toBeGreaterThanOrEqual(12)
  })
})
