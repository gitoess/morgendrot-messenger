import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_OVERRIDE_KEY, getApiBase } from '@/frontend/lib/api/api-base'

describe('getApiBase', () => {
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
        removeItem(key: string) {
          delete this.store[key]
        },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns empty string without override (Next same-origin proxy)', () => {
    expect(getApiBase()).toBe('')
  })

  it('reads APK/LAN override from localStorage', () => {
    window.localStorage.setItem(API_BASE_OVERRIDE_KEY, 'http://192.168.0.10:3342/')
    expect(getApiBase()).toBe('http://192.168.0.10:3342')
  })
})
