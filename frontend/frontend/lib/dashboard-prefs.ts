const FULL_TILES_STORAGE_KEY = 'morgendrot_show_all_tiles'

export function readShowAllTilesPref(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(FULL_TILES_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeShowAllTilesPref(value: boolean) {
  try {
    window.localStorage.setItem(FULL_TILES_STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function isPwaStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
  } catch {
    /* ignore */
  }
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}
