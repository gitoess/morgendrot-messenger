import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'

/** Desktop-Messenger (Electron/.exe) — keine PWA-Installation nötig. */
export function isElectronDesktopShell(): boolean {
  if (typeof navigator === 'undefined') return false
  return /\bElectron\//i.test(navigator.userAgent)
}

/** Loopback/Dev — Settings-Karte entfernt; Helper bleibt für Tests/Restpfade. */
export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/**
 * PWA-Install-UI: nur öffentlicher HTTPS-Browser, nicht APK/Electron/localhost.
 * Produktentscheid 2026-11-16: keine Settings-Karte — Browser-Menü / Installer / APK reichen.
 */
export function shouldShowDashboardPwaInstallCard(): boolean {
  if (isCapacitorNativePlatform()) return false
  if (isElectronDesktopShell()) return false
  if (isLocalDevHost()) return false
  return true
}
