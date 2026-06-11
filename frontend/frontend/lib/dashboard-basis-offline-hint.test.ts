import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/frontend/lib/standalone-device-mode', () => ({
  isStandaloneDeviceMode: vi.fn(() => false),
  shouldPreferStandaloneHandoffStatus: vi.fn(() => false),
  isStandaloneMessengerWithoutBasis: vi.fn(() => false),
}))
vi.mock('@/frontend/lib/api/api-base', () => ({
  getApiBase: vi.fn(() => ''),
}))
vi.mock('@/frontend/lib/handoff-local-apply', () => ({
  readLocalHandoffAppliedSnapshot: vi.fn(() => null),
}))
vi.mock('@/frontend/lib/standalone-onboarding', () => ({
  readStandaloneOnboardingPath: vi.fn(() => null),
  isStandaloneSoloPath: vi.fn(() => false),
}))
vi.mock('@/frontend/lib/i18n/client', () => ({
  ensureI18nInitialized: vi.fn(),
  i18n: {
    t: (key: string, opts?: { ns?: string }) => {
      if (key === 'hints.firstStartChoice') return 'Erststart: Einsatz oder Solo wählen.'
      if (key === 'offline.awaitHandoffSteps') return 'Handoff aktiv — Schritt 2.'
      return key
    },
  },
}))

import { isStandaloneDeviceMode, isStandaloneMessengerWithoutBasis } from '@/frontend/lib/standalone-device-mode'
import { getApiBase } from '@/frontend/lib/api/api-base'
import { getMessengerDashboardOfflineHint } from '@/frontend/lib/dashboard-basis-offline-hint'

describe('dashboard-basis-offline-hint', () => {
  beforeEach(() => {
    vi.mocked(isStandaloneDeviceMode).mockReturnValue(false)
    vi.mocked(isStandaloneMessengerWithoutBasis).mockReturnValue(false)
    vi.mocked(getApiBase).mockReturnValue('http://127.0.0.1:3342')
  })

  it('Standalone ohne Basis', () => {
    vi.mocked(isStandaloneMessengerWithoutBasis).mockReturnValue(true)
    expect(isStandaloneMessengerWithoutBasis()).toBe(true)
    expect(getMessengerDashboardOfflineHint()).toMatch(/Erststart|Einsatz|Solo|firstStart/)
    expect(getMessengerDashboardOfflineHint()).not.toMatch(/npm run dev/)
  })

  it('Deploy mit Basis-URL', () => {
    expect(isStandaloneMessengerWithoutBasis()).toBe(false)
    expect(getMessengerDashboardOfflineHint()).toMatch(/npm run dev/)
  })
})
