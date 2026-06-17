import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_MESSENGER_APPEARANCE,
  MESSENGER_APPEARANCE_STORAGE_KEY,
  applyMessengerAppearance,
  isMessengerAppearanceId,
  persistMessengerAppearance,
  readMessengerAppearanceId,
} from '@/frontend/lib/messenger-appearance-theme'

describe('messenger-appearance-theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-appearance')
    document.documentElement.style.colorScheme = ''
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-appearance')
  })

  it('isMessengerAppearanceId erkennt gültige IDs', () => {
    expect(isMessengerAppearanceId('tactical')).toBe(true)
    expect(isMessengerAppearanceId('invalid')).toBe(false)
  })

  it('readMessengerAppearanceId default ohne Storage', () => {
    expect(readMessengerAppearanceId()).toBe(DEFAULT_MESSENGER_APPEARANCE)
  })

  it('persistMessengerAppearance speichert und wendet an', () => {
    persistMessengerAppearance('tactical')
    expect(localStorage.getItem(MESSENGER_APPEARANCE_STORAGE_KEY)).toBe('tactical')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('tactical')
    expect(readMessengerAppearanceId()).toBe('tactical')
  })

  it('standard entfernt data-appearance und Storage', () => {
    persistMessengerAppearance('tactical')
    persistMessengerAppearance('standard')
    expect(localStorage.getItem(MESSENGER_APPEARANCE_STORAGE_KEY)).toBeNull()
    expect(document.documentElement.hasAttribute('data-appearance')).toBe(false)
  })

  it('light setzt color-scheme', () => {
    applyMessengerAppearance('light')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
