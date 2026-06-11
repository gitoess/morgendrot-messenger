import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  beginStandaloneSoloOnboarding,
  isStandaloneSoloPath,
  needsStandaloneOnboardingChoice,
  readStandaloneOnboardingPath,
  setStandaloneOnboardingPath,
} from './standalone-onboarding'

vi.mock('@/frontend/lib/standalone-device-mode', () => ({
  isStandaloneMessengerWithoutBasis: () => true,
}))

vi.mock('@/frontend/lib/handoff-device-bootstrap', () => ({
  syncLocalHandoffSnapshotToChainContext: vi.fn(),
}))

vi.mock('@/frontend/lib/direct-iota-plain-submit', () => ({
  setIotaSubmitMode: vi.fn(),
  setDirectMailboxDrainEnabled: vi.fn(),
}))

vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  setDirectChainOptimisticFlagsEnabled: vi.fn(),
}))

describe('standalone-onboarding', () => {
  const store: Record<string, string> = {}
  const events: string[] = []

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    events.length = 0
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      },
      dispatchEvent: (e: Event) => {
        events.push(e.type)
        return true
      },
    } as Window & typeof globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('needsStandaloneOnboardingChoice wenn nichts gesetzt', () => {
    expect(needsStandaloneOnboardingChoice()).toBe(true)
  })

  it('beginStandaloneSoloOnboarding setzt Pfad und Profil', () => {
    beginStandaloneSoloOnboarding()
    expect(readStandaloneOnboardingPath()).toBe('solo')
    expect(isStandaloneSoloPath()).toBe(true)
    expect(store['morgendrot.handoff.localApplied.v1']).toContain('consumer')
    expect(needsStandaloneOnboardingChoice()).toBe(false)
    expect(events).toContain('morgendrot.standaloneSoloWalletSetupRequest')
  })

  it('needsStandaloneOnboardingChoice false nach Pfadwahl', () => {
    setStandaloneOnboardingPath('einsatz')
    expect(needsStandaloneOnboardingChoice()).toBe(false)
  })
})
