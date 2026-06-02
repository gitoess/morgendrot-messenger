import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/frontend/lib/capacitor-standalone-bootstrap', () => ({
  isStandaloneDeviceMode: vi.fn(() => false),
}))
vi.mock('@/frontend/lib/api/api-base', () => ({
  getApiBase: vi.fn(() => ''),
}))
vi.mock('@/frontend/lib/handoff-local-apply', () => ({
  readLocalHandoffAppliedSnapshot: vi.fn(() => null),
}))

import { isStandaloneDeviceMode } from '@/frontend/lib/capacitor-standalone-bootstrap'
import { getApiBase } from '@/frontend/lib/api/api-base'
import {
  getMessengerDashboardOfflineHint,
  isStandaloneMessengerWithoutBasis,
} from '@/frontend/lib/dashboard-basis-offline-hint'

describe('dashboard-basis-offline-hint', () => {
  beforeEach(() => {
    vi.mocked(isStandaloneDeviceMode).mockReturnValue(false)
    vi.mocked(getApiBase).mockReturnValue('http://127.0.0.1:3342')
  })

  it('Standalone ohne Basis', () => {
    vi.mocked(isStandaloneDeviceMode).mockReturnValue(true)
    vi.mocked(getApiBase).mockReturnValue('')
    expect(isStandaloneMessengerWithoutBasis()).toBe(true)
    expect(getMessengerDashboardOfflineHint()).toMatch(/Peering-QR/)
    expect(getMessengerDashboardOfflineHint()).not.toMatch(/npm run dev/)
  })

  it('Deploy mit Basis-URL', () => {
    expect(isStandaloneMessengerWithoutBasis()).toBe(false)
    expect(getMessengerDashboardOfflineHint()).toMatch(/npm run dev/)
  })
})
