import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/frontend/lib/capacitor-standalone-bootstrap', () => ({
  isStandaloneDeviceMode: vi.fn(() => false),
}))
vi.mock('@/frontend/lib/api/api-base', () => ({
  getApiBase: vi.fn(() => ''),
}))

import { isStandaloneDeviceMode } from '@/frontend/lib/capacitor-standalone-bootstrap'
import { getApiBase } from '@/frontend/lib/api/api-base'
import {
  canUseMessengerApiRelay,
  shouldSkipMessengerApiRelayFallback,
} from '@/frontend/lib/messenger-standalone-relay'

describe('messenger-standalone-relay', () => {
  beforeEach(() => {
    vi.mocked(isStandaloneDeviceMode).mockReturnValue(false)
    vi.mocked(getApiBase).mockReturnValue('')
  })

  it('skip nur bei Standalone ohne API_BASE', () => {
    expect(shouldSkipMessengerApiRelayFallback()).toBe(false)
    vi.mocked(isStandaloneDeviceMode).mockReturnValue(true)
    expect(shouldSkipMessengerApiRelayFallback()).toBe(true)
    vi.mocked(getApiBase).mockReturnValue('http://boss:3342')
    expect(shouldSkipMessengerApiRelayFallback()).toBe(false)
  })

  it('canUseMessengerApiRelay respektiert Standalone und backendReachable', () => {
    expect(canUseMessengerApiRelay({ backendReachable: true })).toBe(true)
    vi.mocked(isStandaloneDeviceMode).mockReturnValue(true)
    expect(canUseMessengerApiRelay({ backendReachable: true })).toBe(false)
    vi.mocked(getApiBase).mockReturnValue('http://boss:3342')
    expect(canUseMessengerApiRelay({ backendReachable: true })).toBe(true)
    expect(canUseMessengerApiRelay({ backendReachable: false })).toBe(false)
  })
})
