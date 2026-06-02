'use client'

import { getApiBase } from '@/frontend/lib/api/api-base'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'

export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase()
  return h === '127.0.0.1' || h === 'localhost' || h === '::1'
}

/** Auf dem Handy zeigt 127.0.0.1 auf das Gerät selbst — nicht auf den Entwicklungs-PC. */
export function getNativeLoopbackApiBaseWarning(): string | null {
  if (!isCapacitorNativePlatform()) return null
  const base = getApiBase()
  if (!base) {
    return 'Keine Basis-URL gesetzt. Unter Einstellungen → Basis-URL (APK) die LAN-IP deines PCs eintragen, z. B. http://192.168.0.10:3342'
  }
  try {
    if (isLoopbackHostname(new URL(base).hostname)) {
      return '127.0.0.1 / localhost ist auf dem Handy nicht dein PC. Im WLAN die IPv4 des PCs nutzen (ipconfig), z. B. http://192.168.0.10:3342 — und am PC npm run dev:lan starten.'
    }
  } catch {
    return 'Basis-URL ist ungültig — bitte http://<PC-IP>:3342 ohne Leerzeichen.'
  }
  return null
}
