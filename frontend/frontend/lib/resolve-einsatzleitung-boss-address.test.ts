import { describe, expect, it, beforeEach } from 'vitest'
import {
  resolveEinsatzleitungBossAddress,
  resolveTeamSyncSigningAddress,
} from '@/frontend/lib/resolve-einsatzleitung-boss-address'

const BOSS = '0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5'
const HELPER = '0x8714bf000000000000000000000000000000000000000000000000000000f08a'

describe('resolveEinsatzleitungBossAddress', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('bevorzugt api bossAddress vor myAddressFull', () => {
    expect(
      resolveEinsatzleitungBossAddress({
        bossAddress: BOSS,
        myAddressFull: HELPER,
      })
    ).toBe(BOSS.toLowerCase())
  })

  it('nutzt Handoff-BOSS wenn Wire-Kontext fehlt', () => {
    window.localStorage.setItem(
      'morgendrot.handoff.localApplied.v1',
      JSON.stringify({ savedAtMs: 1, bossAddress: BOSS })
    )
    expect(resolveEinsatzleitungBossAddress({ myAddressFull: HELPER })).toBe(BOSS.toLowerCase())
  })
})

describe('resolveTeamSyncSigningAddress', () => {
  it('liefert nur myAddressFull/myAddress — nicht bossAddress', () => {
    expect(
      resolveTeamSyncSigningAddress({
        bossAddress: BOSS,
        myAddressFull: HELPER,
      })
    ).toBe(HELPER.toLowerCase())
  })
})
