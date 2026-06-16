import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

async function resetDirectIotaMnemonicSessionForVitest(): Promise<void> {
  try {
    const mod = await import('@/frontend/lib/direct-iota-mnemonic-session')
    await mod.drainDirectIotaTabSessionPersistForTests()
    mod.resetDirectIotaMnemonicSessionModuleForTests()
  } catch {
    /* Modul-Graph in isolierten Tests optional */
  }
}

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

afterEach(async () => {
  await resetDirectIotaMnemonicSessionForVitest()
  cleanup()
  vi.unstubAllGlobals()
})

afterAll(async () => {
  await resetDirectIotaMnemonicSessionForVitest()
})
