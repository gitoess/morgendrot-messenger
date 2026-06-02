import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ANDROID_FG_SYNC_BOOTSTRAPPED_KEY,
  ANDROID_FG_SYNC_ENABLED_KEY,
  bootstrapAndroidFgSyncPreference,
  canUseAndroidForegroundSync,
  isAndroidFgSyncEnabled,
  setAndroidFgSyncEnabled,
} from '@/frontend/lib/capacitor-foreground-sync'

vi.mock('@/frontend/lib/capacitor-platform', () => ({
  isCapacitorNativePlatform: vi.fn(() => false),
}))

describe('capacitor-foreground-sync', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('is disabled on web', () => {
    expect(canUseAndroidForegroundSync()).toBe(false)
    expect(isAndroidFgSyncEnabled()).toBe(false)
    setAndroidFgSyncEnabled(true)
    expect(isAndroidFgSyncEnabled()).toBe(false)
  })

  it('bootstraps enabled on first native run', async () => {
    const { isCapacitorNativePlatform } = await import('@/frontend/lib/capacitor-platform')
    vi.mocked(isCapacitorNativePlatform).mockReturnValue(true)

    bootstrapAndroidFgSyncPreference()
    expect(window.localStorage.getItem(ANDROID_FG_SYNC_BOOTSTRAPPED_KEY)).toBe('1')
    expect(window.localStorage.getItem(ANDROID_FG_SYNC_ENABLED_KEY)).toBe('1')

    bootstrapAndroidFgSyncPreference()
    setAndroidFgSyncEnabled(false)
    bootstrapAndroidFgSyncPreference()
    expect(window.localStorage.getItem(ANDROID_FG_SYNC_ENABLED_KEY)).toBeNull()
  })
})
