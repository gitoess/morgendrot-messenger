import { describe, expect, it, beforeEach } from 'vitest'
import {
  isSettingsCategoryVisible,
  primeSettingsCategory,
  SETTINGS_ACTIVE_CATEGORY_KEY,
} from './settings-navigation'

describe('settings-navigation', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('primeSettingsCategory setzt IOTA-Kategorie', () => {
    primeSettingsCategory('iota')
    expect(sessionStorage.getItem(SETTINGS_ACTIVE_CATEGORY_KEY)).toBe('iota')
  })

  it('isSettingsCategoryVisible blendet Funk/Telegram aus', () => {
    expect(isSettingsCategoryVisible('funk', { hideFunk: true })).toBe(false)
    expect(isSettingsCategoryVisible('telegram', { hideTelegram: true })).toBe(false)
    expect(isSettingsCategoryVisible('iota', { hideFunk: true, hideTelegram: true })).toBe(true)
  })
})
