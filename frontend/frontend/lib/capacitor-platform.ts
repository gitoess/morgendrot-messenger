'use client'

import { Capacitor } from '@capacitor/core'

export function isCapacitorNativePlatform(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform()
}

/** APK/WebView ohne Next-`/api`-Proxy — Basis-URL muss explizit gesetzt werden. */
export function shouldShowCapacitorApiBaseSettings(): boolean {
  return isCapacitorNativePlatform()
}
