import { describe, expect, it, beforeEach } from 'vitest'
import { resolveDashboardEmergencyPartner } from '@/frontend/lib/resolve-dashboard-emergency-partner'

const ME = '0xd5fae30bb2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const BOSS = '0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5'

describe('resolveDashboardEmergencyPartner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('findet Boss im Kontaktverzeichnis', () => {
    expect(
      resolveDashboardEmergencyPartner({
        myAddress: ME,
        directory: { [BOSS]: { label: 'Boss' } },
      })
    ).toBe(BOSS)
  })

  it('liest Boss aus Handoff-localStorage', () => {
    localStorage.setItem(
      'morgendrot.contacts.directory.v1',
      JSON.stringify({ directory: { [BOSS]: { label: 'Boss' } } })
    )
    expect(
      resolveDashboardEmergencyPartner({
        myAddress: ME,
        directory: {},
      })
    ).toBe(BOSS)
  })

  it('liest legacy peers-Snapshot', () => {
    localStorage.setItem(
      'morgendrot.connectedPeersSnapshot.v1',
      JSON.stringify({ peers: [{ address: BOSS, label: 'Boss' }], savedAtMs: Date.now() })
    )
    expect(
      resolveDashboardEmergencyPartner({
        myAddress: ME,
        directory: {},
      })
    ).toBe(BOSS)
  })
})
