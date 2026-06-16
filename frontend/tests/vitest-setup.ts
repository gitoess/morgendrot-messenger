import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
})

afterEach(async () => {
  try {
    const { drainDirectIotaTabSessionPersistForTests } = await import(
      '@/frontend/lib/direct-iota-mnemonic-session'
    )
    await drainDirectIotaTabSessionPersistForTests()
  } catch {
    /* Modul-Graph in isolierten Tests optional */
  }
  cleanup()
  vi.unstubAllGlobals()
})
