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

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k]
        store['morgendrot.locale'] = 'de'
      },
      get length() {
        return Object.keys(store).length
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
    },
  })

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => createMatchMedia(query),
  })

  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: 'de-DE',
  })
}

import { ensureI18nInitialized, i18n } from '@/frontend/lib/i18n/client'

if (typeof document !== 'undefined') {
  ensureI18nInitialized()
  void i18n.changeLanguage('de')
}
