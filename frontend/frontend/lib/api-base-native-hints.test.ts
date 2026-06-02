import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getNativeLoopbackApiBaseWarning } from '@/frontend/lib/api-base-native-hints'

vi.mock('@/frontend/lib/capacitor-platform', () => ({
  isCapacitorNativePlatform: () => true,
}))

describe('getNativeLoopbackApiBaseWarning', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: {
        store: {} as Record<string, string>,
        getItem(key: string) {
          return this.store[key] ?? null
        },
        setItem(key: string, value: string) {
          this.store[key] = value
        },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('warns on 127.0.0.1 in native app', async () => {
    const { API_BASE_OVERRIDE_KEY } = await import('@/frontend/lib/api/api-base')
    window.localStorage.setItem(API_BASE_OVERRIDE_KEY, 'http://127.0.0.1:3342')
    expect(getNativeLoopbackApiBaseWarning()).toMatch(/Handy/)
  })

  it('allows LAN IP', async () => {
    const { API_BASE_OVERRIDE_KEY } = await import('@/frontend/lib/api/api-base')
    window.localStorage.setItem(API_BASE_OVERRIDE_KEY, 'http://192.168.1.50:3342')
    expect(getNativeLoopbackApiBaseWarning()).toBeNull()
  })
})
