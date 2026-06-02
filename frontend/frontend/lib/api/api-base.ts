/** Laufzeit-Override für Capacitor/APK (LAN-PC), siehe Einstellungen → „Basis-URL (APK)“. */
export const API_BASE_OVERRIDE_KEY = 'morgendrot.apiBaseOverride'

function readBuildTimeApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/$/, '')
}

/** Explizit setzen, wenn kein Next-Rewrite (z. B. statischer Export/APK). Sonst leer = gleiche Origin + `rewrites`. */
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    try {
      const override = window.localStorage.getItem(API_BASE_OVERRIDE_KEY)?.trim().replace(/\/$/, '')
      if (override) return override
    } catch {
      // optional
    }
    const explicit = readBuildTimeApiBase()
    if (explicit) return explicit
    return ''
  }
  const explicit = readBuildTimeApiBase()
  if (explicit) return explicit
  return 'http://127.0.0.1:3342'
}

/** @deprecated Prefer `getApiBase()` for client fetches — constant is fixed at module load. */
export const API_BASE = typeof window === 'undefined' ? getApiBase() : ''
