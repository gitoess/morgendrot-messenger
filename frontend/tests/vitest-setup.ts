import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

/**
 * jsdom-Setup: nur wenn document vorhanden (@vitest-environment node überspringt).
 * Kein afterEach-Drain für direct-iota-session — bricht Standalone-/Relay-Tests (Modul-Singleton).
 * Projekt-Ende: tests/vitest-global-teardown.ts
 */

function isDomTestEnv(): boolean {
  return typeof document !== 'undefined'
}

beforeEach(() => {
  if (!isDomTestEnv()) return
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )
})

afterEach(() => {
  if (!isDomTestEnv()) return
  cleanup()
  vi.useRealTimers()
  vi.clearAllTimers()
  vi.unstubAllGlobals()
})
