import type { StringStoragePort } from './storage'

/** In-Memory `Storage`-Subset für Vitest, Headless, CM4-Prototypen. */
export function createMemoryStringStorage(
  initial: Record<string, string> = {}
): StringStoragePort & { dump(): Record<string, string>; clear(): void } {
  const map = { ...initial }
  return {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(map, key) ? map[key]! : null
    },
    setItem(key: string, value: string) {
      map[key] = value
    },
    dump: () => ({ ...map }),
    clear: () => {
      for (const k of Object.keys(map)) delete map[k]
    },
  }
}

/**
 * Delegiert auf ein zur Laufzeit auflösbares Storage (z. B. `null` in SSR, `localStorage` im Browser).
 * `getItem` liefert `null`, wenn `resolve()` `null` ist; `setItem` ist dann No-Op.
 */
export function createNullableDelegatingStorage(
  resolve: () => StringStoragePort | null
): StringStoragePort {
  return {
    getItem(key: string) {
      const s = resolve()
      return s ? s.getItem(key) : null
    },
    setItem(key: string, value: string) {
      resolve()?.setItem(key, value)
    },
  }
}
