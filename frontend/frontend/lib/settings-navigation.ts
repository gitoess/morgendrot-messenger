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
