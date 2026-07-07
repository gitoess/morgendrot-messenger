'use client'

import { getApiBase } from '@/frontend/lib/api/api-base'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'

const LS_AUTARKY_MODE = 'morgendrot.autarkyMode'

export function isAutarkyModeEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_AUTARKY_MODE) === '1'
  } catch {
    return false
  }
}

export function isStandaloneDeviceMode(): boolean {
  return isCapacitorNativePlatform() || isAutarkyModeEnabled()
}

/** APK mit Handoff/Autarkie: auch bei gesetzter (nutzloser) Basis-URL Standalone-Status nutzen. */
export function shouldPreferStandaloneHandoffStatus(): boolean {
  if (!isCapacitorNativePlatform()) return false
  if (isAutarkyModeEnabled()) return true
  return Boolean(readLocalHandoffAppliedSnapshot())
}

/** APK/Autarkie: Direkt-RPC + lokales Handoff — keine Morgendrot-Basis nötig. */
export function isStandaloneMessengerWithoutBasis(): boolean {
  /** Nur native APK — Desktop-Browser nutzt immer POST /api/unlock gegen den Node-Tresor. */
  if (!isCapacitorNativePlatform()) return false
  if (!isStandaloneDeviceMode()) return false
  if (!getApiBase().trim()) return true
  return shouldPreferStandaloneHandoffStatus()
}
