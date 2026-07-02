import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  readOnboardingProgress,
  startOnboarding,
  markOnboardingStepComplete,
  needsOnboardingResume,
  finishOnboarding,
  isOnboardingFinished,
  prepareOnboardingWizardOpen,
  shouldSkipOnboardingStep,
  resolveWizardOnboardingPath,
  resolveOnboardingDialogPath,
  getWizardViewStep,
  goBackOnboardingStep,
  onboardingProgressPercent,
  buildOnboardingSkipContext,
  shouldOfferMessengerSetupFromVault,
  resolveMessengerSetupOnboardingPath,
  dismissOnboarding,
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
  getDirectIotaSessionSigner: () => null,
}))

const isBrowserSessionSignerReadyMock = vi.fn((_uiLocked = false) => false)
vi.mock('@/frontend/lib/messenger-session-keys-ready', () => ({
  isBrowserSessionSignerReady: (uiLocked?: boolean) => isBrowserSessionSignerReadyMock(uiLocked ?? false),
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
    expect(isOnboardingFinished()).toBe(true)
  })

  it('prepareOnboardingWizardOpen hebt Fertig-Flag für Wiederöffnen', () => {
    startOnboarding('boss')
    finishOnboarding()
    expect(isOnboardingFinished()).toBe(true)
    prepareOnboardingWizardOpen('boss')
    expect(isOnboardingFinished()).toBe(false)
    expect(getWizardViewStep(readOnboardingProgress()!).stepId).toBe('wallet')
  })

  it('startOnboarding setzt nach Fertig zurück auf Schritt 1', () => {
    startOnboarding('boss')
    finishOnboarding()
    startOnboarding('boss')
    expect(isOnboardingFinished()).toBe(false)
    expect(getWizardViewStep(readOnboardingProgress()!).stepId).toBe('wallet')
  })

  it('shouldSkipOnboardingStep handoff wenn nicht da', () => {
    expect(shouldSkipOnboardingStep('helper', 'handoff')).toBe(false)
  })

  it('markOnboardingStepComplete erhöht Index', () => {
    startOnboarding('wanderer')
    markOnboardingStepComplete('wallet')
    expect(readOnboardingProgress()?.completedSteps).toContain('wallet')
  })

  it('shouldOfferMessengerSetupFromVault bis Wizard fertig', () => {
    expect(shouldOfferMessengerSetupFromVault('boss')).toBe(true)
    startOnboarding('boss')
    expect(shouldOfferMessengerSetupFromVault('boss')).toBe(true)
    dismissOnboarding()
    expect(shouldOfferMessengerSetupFromVault('boss')).toBe(true)
    startOnboarding('boss')
    finishOnboarding()
    expect(shouldOfferMessengerSetupFromVault('boss')).toBe(false)
    window.localStorage.removeItem('morgendrot.onboardingProgress.v2')
    expect(shouldOfferMessengerSetupFromVault('messenger')).toBe(true)
    expect(shouldOfferMessengerSetupFromVault('arbeiter')).toBe(false)
  })

  it('resolveMessengerSetupOnboardingPath', () => {
    expect(resolveMessengerSetupOnboardingPath('boss')).toBe('boss')
    expect(resolveMessengerSetupOnboardingPath('messenger')).toBe('wanderer')
  })

  it('boss wallet skip nur bei Browser-Signer', () => {
    isBrowserSessionSignerReadyMock.mockReturnValue(true)
    const ctx = buildOnboardingSkipContext({ hasKeys: true, locked: false })
    expect(shouldSkipOnboardingStep('boss', 'wallet', ctx)).toBe(true)
    isBrowserSessionSignerReadyMock.mockReturnValue(false)
    expect(shouldSkipOnboardingStep('boss', 'wallet', { hasWallet: false })).toBe(false)
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
    expect(getWizardViewStep(p).stepId).toBe('network-plan')
    goBackOnboardingStep('network-plan')
    const back = readOnboardingProgress()!
    expect(getWizardViewStep(back).stepId).toBe('wallet')
  })

  it('onboardingProgressPercent folgt Wizard-Position (nicht erledigte/auto-skip Schritte)', () => {
    startOnboarding('boss')
    expect(onboardingProgressPercent(readOnboardingProgress()!)).toBe(13)
    markOnboardingStepComplete('wallet')
    markOnboardingStepComplete('network-plan')
    markOnboardingStepComplete('einsatz-rules')
    expect(onboardingProgressPercent(readOnboardingProgress()!)).toBe(50)
    goBackOnboardingStep('chain')
    expect(onboardingProgressPercent(readOnboardingProgress()!)).toBe(38)
    const ctx = buildOnboardingSkipContext({ packageId: '0x' + 'a'.repeat(64) })
    expect(onboardingProgressPercent(readOnboardingProgress()!, ctx)).toBe(38)
  })

  it('goBack von Fertig löscht finishedAtMs', () => {
    startOnboarding('boss')
    finishOnboarding()
    expect(isOnboardingFinished()).toBe(true)
    goBackOnboardingStep('done')
    expect(isOnboardingFinished()).toBe(false)
    expect(getWizardViewStep(readOnboardingProgress()!).stepId).toBe('meshtastic')
  })

  it('migriert entfernten helpers-Schritt aus Boss-Wizard', () => {
    window.localStorage.setItem(
      'morgendrot.onboardingProgress.v2',
      JSON.stringify({
        path: 'boss',
        currentStepIndex: 8,
        completedSteps: [
          'wallet',
          'network-plan',
          'einsatz-rules',
          'chain',
          'mailboxes',
          'telegram',
          'meshtastic',
          'helpers',
        ],
        skippedSteps: [],
        dismissed: false,
      })
    )
    const p = readOnboardingProgress()!
    expect(p.skippedSteps).toContain('helpers')
    expect(p.completedSteps).not.toContain('helpers')
    expect(getWizardViewStep(p).stepId).toBe('done')
  })

  it('migriert legacy package zu chain', () => {
    window.localStorage.setItem(
      'morgendrot.onboardingProgress.v2',
      JSON.stringify({
        path: 'boss',
        currentStepIndex: 2,
        completedSteps: ['wallet', 'package'],
        skippedSteps: [],
        dismissed: false,
      })
    )
    const p = readOnboardingProgress()!
    expect(p.completedSteps).toContain('chain')
    expect(p.completedSteps).not.toContain('package')
    expect(p.skippedSteps).toContain('einsatz-rules')
    expect(getWizardViewStep(p).stepId).toBe('mailboxes')
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
    expect(p.completedSteps).not.toContain('server-mailbox')
    expect(getWizardViewStep(p).stepId).toBe('mailboxes')
  })

  it('migriert legacy telegram-bot/group zu telegram', () => {
    window.localStorage.setItem(
      'morgendrot.onboardingProgress.v2',
      JSON.stringify({
        path: 'boss',
        currentStepIndex: 6,
        completedSteps: ['wallet', 'address', 'package', 'mailboxes', 'telegram-bot', 'telegram-group'],
        skippedSteps: [],
        dismissed: false,
      })
    )
    const p = readOnboardingProgress()!
    expect(p.completedSteps).toContain('telegram')
    expect(p.completedSteps).not.toContain('telegram-bot')
    expect(getWizardViewStep(p).stepId).toBe('meshtastic')
  })
})
