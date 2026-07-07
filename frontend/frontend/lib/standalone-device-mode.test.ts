import { beforeEach, describe, expect, it, vi } from 'vitest'

const store: Record<string, string> = {}

vi.mock('@/frontend/lib/capacitor-platform', () => ({
  isCapacitorNativePlatform: vi.fn(() => false),
}))

vi.mock('@/frontend/lib/api/api-base', () => ({
  getApiBase: vi.fn(() => ''),
}))

vi.mock('@/frontend/lib/handoff-local-apply', () => ({
  readLocalHandoffAppliedSnapshot: vi.fn(() => null),
}))

import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/standalone-device-mode'

describe('isStandaloneMessengerWithoutBasis', () => {
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
    } as Window & typeof globalThis)
    vi.mocked(isCapacitorNativePlatform).mockReturnValue(false)
  })

  it('ist auf Desktop-Browser false, auch mit Autarkie-Flag', () => {
    store['morgendrot.autarkyMode'] = '1'
    expect(isStandaloneMessengerWithoutBasis()).toBe(false)
  })

  it('ist auf Capacitor-APK mit Autarkie true ohne Basis-URL', () => {
    vi.mocked(isCapacitorNativePlatform).mockReturnValue(true)
    store['morgendrot.autarkyMode'] = '1'
    expect(isStandaloneMessengerWithoutBasis()).toBe(true)
  })
})
