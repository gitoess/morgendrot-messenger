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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
