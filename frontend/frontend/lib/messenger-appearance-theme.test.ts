import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_CUSTOM_APPEARANCE,
  DEFAULT_MESSENGER_APPEARANCE,
  MESSENGER_APPEARANCE_STORAGE_KEY,
  applyMessengerAppearance,
  isMessengerAppearanceId,
  normalizeMessengerAppearanceId,
  persistCustomAppearance,
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

  it('Custom: Sendepfad-Farben setzen --path-* (auch für Chatblasen)', () => {
    persistCustomAppearance(true, {
      ...DEFAULT_CUSTOM_APPEARANCE,
      pathOnline: '#112233',
      pathMesh: '#445566',
      pathTelegram: '#778899',
      pathIota: '#aabbcc',
      pathAdhoc: '#ddeeff',
      pathSos: '#ff0011',
      card: '#0a0b0c',
    })
    const s = document.documentElement.style
    expect(document.documentElement.getAttribute('data-appearance')).toBe('custom')
    expect(s.getPropertyValue('--path-online').trim()).toBe('#112233')
    expect(s.getPropertyValue('--path-mesh').trim()).toBe('#445566')
    expect(s.getPropertyValue('--path-telegram').trim()).toBe('#778899')
    expect(s.getPropertyValue('--path-iota').trim()).toBe('#aabbcc')
    expect(s.getPropertyValue('--path-adhoc').trim()).toBe('#ddeeff')
    expect(s.getPropertyValue('--path-sos').trim()).toBe('#ff0011')
    expect(s.getPropertyValue('--card').trim()).toBe('#0a0b0c')
    expect(s.getPropertyValue('--card').trim()).not.toBe(s.getPropertyValue('--background').trim())
  })
})
