/** Session-Key für vorausgewählte Einstellungs-Kategorie (siehe SettingsView). */
export const SETTINGS_ACTIVE_CATEGORY_KEY = 'morgendrot.settingsActiveCategory'

export type SettingsCategoryId = 'general' | 'iota' | 'funk' | 'telegram' | 'security'

export function primeSettingsCategory(category: SettingsCategoryId): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SETTINGS_ACTIVE_CATEGORY_KEY, category)
  } catch {
    /* ignore */
  }
}

/** Kategorien ausblenden (IOTA-Messenger: kein Funk/Telegram-Tab). */
export function isSettingsCategoryVisible(
  id: SettingsCategoryId,
  caps: { hideFunk?: boolean; hideTelegram?: boolean }
): boolean {
  if (id === 'funk' && caps.hideFunk) return false
  if (id === 'telegram' && caps.hideTelegram) return false
  return true
}
