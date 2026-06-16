import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

/**
 * jsdom-Setup: nur wenn document vorhanden (@vitest-environment node überspringt).
 * Kein globales Drain für direct-iota-mnemonic-session — Fork-Isolation + lokales afterEach.
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
  vi.unstubAllGlobals()
})
