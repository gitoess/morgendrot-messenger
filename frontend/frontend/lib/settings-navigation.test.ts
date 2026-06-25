import { describe, expect, it, beforeEach } from 'vitest'
import { primeSettingsCategory, SETTINGS_ACTIVE_CATEGORY_KEY } from './settings-navigation'

describe('settings-navigation', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('primeSettingsCategory setzt IOTA-Kategorie', () => {
    primeSettingsCategory('iota')
    expect(sessionStorage.getItem(SETTINGS_ACTIVE_CATEGORY_KEY)).toBe('iota')
  })
})
