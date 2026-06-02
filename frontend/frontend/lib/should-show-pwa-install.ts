import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'

/** Desktop-Messenger (Electron/.exe) — keine PWA-Installation nötig. */
export function isElectronDesktopShell(): boolean {
  if (typeof navigator === 'undefined') return false
  return /\bElectron\//i.test(navigator.userAgent)
}

/** PWA-Install-Hinweis nur im Browser (nicht APK, nicht Electron). */
export function shouldShowDashboardPwaInstallCard(): boolean {
  if (isCapacitorNativePlatform()) return false
  if (isElectronDesktopShell()) return false
  return true
}
