import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

/**
 * Kein globales Drain/Reset für direct-iota-mnemonic-session:
 * - pool:forks isoliert Testdateien (Singleton-Leaks zwischen Dateien unmöglich)
 * - Tab-Persist ist in Vitest standardmäßig aus
 * - Session-Tests räumen lokal in afterEach auf (siehe direct-iota-*-session.test.ts)
 * Globales dynamisches Importieren nach jedem Test verursachte CI-Flakes (Suite rot, Tests grün).
 */

beforeEach(() => {
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
  cleanup()
  vi.unstubAllGlobals()
})
