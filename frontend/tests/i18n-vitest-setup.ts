import { vi } from 'vitest'

const store: Record<string, string> = {
  'morgendrot.locale': 'de',
}

function createMatchMedia(query: string) {
  return {
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

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
  navigator: { language: 'de-DE', standalone: false },
  dispatchEvent: () => true,
  matchMedia: (query: string) => createMatchMedia(query),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as Window & typeof globalThis)

import { ensureI18nInitialized, i18n } from '@/frontend/lib/i18n/client'

ensureI18nInitialized()
void i18n.changeLanguage('de')
