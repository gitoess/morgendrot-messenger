import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  beginStandaloneBossOnboarding,
  beginStandaloneEinsatzOnboarding,
  beginStandaloneSoloOnboarding,
  isStandaloneBossPath,
  isStandaloneEinsatzPath,
  isStandaloneSoloPath,
  needsFirstStartChoice,
  needsStandaloneOnboardingChoice,
  readStandaloneOnboardingPath,
  setStandaloneOnboardingPath,
  shouldApplyMeshFirstTransportDefault,
} from './standalone-onboarding'
import { requestOpenOnboardingWizard } from './onboarding-progress-store'

vi.mock('@/frontend/lib/onboarding-boss-bootstrap', () => ({
  ensureBossRoleOnServer: vi.fn(async () => ({ ok: true })),
}))

vi.mock('@/frontend/lib/onboarding-progress-store', () => ({
  startOnboarding: vi.fn(),
  requestOpenOnboardingWizard: vi.fn(),
  readOnboardingProgress: () => null,
}))

vi.mock('@/frontend/lib/standalone-device-mode', () => ({
  isStandaloneMessengerWithoutBasis: () => true,
}))

vi.mock('@/frontend/lib/handoff-device-bootstrap', () => ({
  syncLocalHandoffSnapshotToChainContext: vi.fn(),
}))

vi.mock('@/frontend/lib/direct-iota-plain-submit', () => ({
  setIotaSubmitMode: vi.fn(),
  setDirectMailboxDrainEnabled: vi.fn(),
  getIotaSubmitMode: vi.fn(() => 'client'),
  isDirectMailboxDrainEnabled: vi.fn(() => true),
}))

vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  setDirectChainOptimisticFlagsEnabled: vi.fn(),
  getDirectChainIdsReadiness: vi.fn(() => ({ ready: true, missing: [] })),
}))

describe('standalone-onboarding', () => {
  const store: Record<string, string> = {}
  const events: string[] = []

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    events.length = 0
    vi.mocked(requestOpenOnboardingWizard).mockClear()
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

  it('beginStandaloneSoloOnboarding setzt Pfad und Profil ohne Wizard-Zwang', () => {
    beginStandaloneSoloOnboarding()
    expect(readStandaloneOnboardingPath()).toBe('solo')
    expect(isStandaloneSoloPath()).toBe(true)
    expect(store['morgendrot.handoff.localApplied.v1']).toContain('consumer')
    expect(store['morgendrot.handoff.localApplied.v1']).toContain('iota-anchored')
    expect(needsFirstStartChoice()).toBe(false)
    expect(requestOpenOnboardingWizard).not.toHaveBeenCalled()
    expect(events).not.toContain('morgendrot.standaloneSoloWalletSetupRequest')
  })

  it('beginStandaloneBossOnboarding öffnet keinen Wizard automatisch', () => {
    beginStandaloneBossOnboarding()
    expect(readStandaloneOnboardingPath()).toBe('boss')
    expect(isStandaloneBossPath()).toBe(true)
    expect(requestOpenOnboardingWizard).not.toHaveBeenCalled()
  })

  it('beginStandaloneEinsatzOnboarding öffnet keinen Wizard automatisch', () => {
    beginStandaloneEinsatzOnboarding()
    expect(readStandaloneOnboardingPath()).toBe('einsatz')
    expect(isStandaloneEinsatzPath()).toBe(true)
    expect(requestOpenOnboardingWizard).not.toHaveBeenCalled()
  })

  it('needsStandaloneOnboardingChoice false nach Pfadwahl', () => {
    setStandaloneOnboardingPath('einsatz')
    expect(needsStandaloneOnboardingChoice()).toBe(false)
  })

  it('Solo: kein automatischer Funk-Sendepfad bei mesh-first-Profil', () => {
    setStandaloneOnboardingPath('solo')
    expect(shouldApplyMeshFirstTransportDefault('mesh-first')).toBe(false)
  })

  it('Standalone mit Direkt-RPC: kein Funk-Default bei mesh-first', () => {
    setStandaloneOnboardingPath('einsatz')
    expect(shouldApplyMeshFirstTransportDefault('mesh-first')).toBe(false)
  })
})
