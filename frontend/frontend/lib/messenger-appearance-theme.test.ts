import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_MESSENGER_APPEARANCE,
  MESSENGER_APPEARANCE_STORAGE_KEY,
  applyMessengerAppearance,
  isMessengerAppearanceId,
  normalizeMessengerAppearanceId,
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

  it('isMessengerAppearanceId: nur standard + light', () => {
    expect(isMessengerAppearanceId('standard')).toBe(true)
    expect(isMessengerAppearanceId('light')).toBe(true)
    expect(isMessengerAppearanceId('tactical')).toBe(false)
    expect(isMessengerAppearanceId('high-contrast')).toBe(false)
  })

  it('normalize: alte Presets → standard', () => {
    expect(normalizeMessengerAppearanceId('tactical')).toBe('standard')
    expect(normalizeMessengerAppearanceId('high-contrast')).toBe('standard')
    expect(normalizeMessengerAppearanceId('light')).toBe('light')
  })

  it('readMessengerAppearanceId default ohne Storage', () => {
    expect(readMessengerAppearanceId()).toBe(DEFAULT_MESSENGER_APPEARANCE)
  })

  it('persistMessengerAppearance speichert light', () => {
    persistMessengerAppearance('light')
    expect(localStorage.getItem(MESSENGER_APPEARANCE_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('light')
    expect(readMessengerAppearanceId()).toBe('light')
  })

  it('standard entfernt data-appearance und Storage', () => {
    persistMessengerAppearance('light')
    persistMessengerAppearance('standard')
    expect(localStorage.getItem(MESSENGER_APPEARANCE_STORAGE_KEY)).toBeNull()
    expect(document.documentElement.hasAttribute('data-appearance')).toBe(false)
  })

  it('legacy tactical Storage wird auf standard migriert', () => {
    localStorage.setItem(MESSENGER_APPEARANCE_STORAGE_KEY, 'tactical')
    expect(readMessengerAppearanceId()).toBe('standard')
    expect(localStorage.getItem(MESSENGER_APPEARANCE_STORAGE_KEY)).toBeNull()
  })

  it('light setzt color-scheme', () => {
    applyMessengerAppearance('light')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
