import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  readOnboardingProgress,
  startOnboarding,
  markOnboardingStepComplete,
  needsOnboardingResume,
  finishOnboarding,
  shouldSkipOnboardingStep,
  resolveWizardOnboardingPath,
  resolveOnboardingDialogPath,
  getWizardViewStep,
  goBackOnboardingStep,
  buildOnboardingSkipContext,
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

  it('boss wallet skip wenn hasWallet', () => {
    const ctx = buildOnboardingSkipContext({ hasKeys: true, locked: false })
    expect(shouldSkipOnboardingStep('boss', 'wallet', ctx)).toBe(true)
    expect(shouldSkipOnboardingStep('boss', 'wallet', {})).toBe(false)
  })

  it('resolveWizardOnboardingPath boss aus Progress', () => {
    startOnboarding('boss')
    expect(resolveWizardOnboardingPath({ role: 'messenger' })).toBe('boss')
  })

  it('resolveOnboardingDialogPath helper bei einsatz Pfad', () => {
    window.localStorage.setItem('morgendrot.standaloneOnboardingPath.v1', 'einsatz')
    expect(resolveOnboardingDialogPath({ role: 'messenger' })).toBe('helper')
  })

  it('helper handoff skip mit Backend-Config', () => {
    const ctx = buildOnboardingSkipContext({
      packageId: '0x' + 'a'.repeat(64),
      mailboxId: '0x' + 'b'.repeat(64),
    })
    expect(shouldSkipOnboardingStep('helper', 'handoff', ctx)).toBe(true)
  })

  it('getWizardViewStep zeigt currentStepIndex auch bei completed', () => {
    startOnboarding('boss')
    markOnboardingStepComplete('wallet')
    const p = readOnboardingProgress()!
    expect(getWizardViewStep(p).stepId).toBe('address')
    goBackOnboardingStep('address')
    const back = readOnboardingProgress()!
    expect(getWizardViewStep(back).stepId).toBe('wallet')
  })

  it('migriert legacy server-mailbox/team zu mailboxes', () => {
    window.localStorage.setItem(
      'morgendrot.onboardingProgress.v2',
      JSON.stringify({
        path: 'boss',
        currentStepIndex: 4,
        completedSteps: ['wallet', 'address', 'package', 'server-mailbox'],
        skippedSteps: [],
        dismissed: false,
      })
    )
    const p = readOnboardingProgress()!
    expect(p.completedSteps).not.toContain('mailboxes')
    expect(p.completedSteps).not.toContain('server-mailbox')
    expect(getWizardViewStep(p).stepId).toBe('mailboxes')
  })
})
