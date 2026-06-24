import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  readOnboardingProgress,
  startOnboarding,
  markOnboardingStepComplete,
  needsOnboardingResume,
  finishOnboarding,
  shouldSkipOnboardingStep,
} from '@/frontend/lib/onboarding-progress-store'

vi.mock('@/frontend/lib/handoff-standalone-ready', () => ({
  getStandaloneHelperReadiness: () => ({
    standaloneMode: true,
    hasHandoff: false,
    configuredFromHandoff: {},
    needsMnemonic: true,
    readyForChat: false,
    remainingStepLabels: [],
  }),
}))

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  hasPersistedDirectIotaSessionSigner: () => false,
}))

vi.mock('@/frontend/lib/handoff-local-apply', () => ({
  readLocalHandoffAppliedSnapshot: () => null,
}))

vi.mock('@/frontend/lib/handoff-extras', () => ({
  readTelegramInviteFromHandoffExtras: () => '',
}))

vi.mock('@/frontend/lib/telegram-alarm-group-prefs', () => ({
  isTelegramAlarmGroupWizardDismissed: () => false,
}))

vi.mock('@/frontend/lib/standalone-onboarding', () => ({
  readStandaloneOnboardingPath: () => 'einsatz',
  isStandaloneSoloPath: () => false,
}))

describe('onboarding-progress-store', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
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
      dispatchEvent: () => true,
    } as unknown as Window & typeof globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('startOnboarding helper', () => {
    startOnboarding('helper')
    expect(readOnboardingProgress()?.path).toBe('helper')
    expect(needsOnboardingResume()).toBe(true)
  })

  it('finishOnboarding beendet Resume', () => {
    startOnboarding('helper')
    finishOnboarding()
    expect(needsOnboardingResume()).toBe(false)
  })

  it('shouldSkipOnboardingStep handoff wenn nicht da', () => {
    expect(shouldSkipOnboardingStep('helper', 'handoff')).toBe(false)
  })

  it('markOnboardingStepComplete erhöht Index', () => {
    startOnboarding('wanderer')
    markOnboardingStepComplete('wallet')
    expect(readOnboardingProgress()?.completedSteps).toContain('wallet')
  })
})
