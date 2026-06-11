'use client'

import { registerPlugin } from '@capacitor/core'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'

export const ANDROID_FG_SYNC_ENABLED_KEY = 'morgendrot.androidFgSync.enabled'
export const ANDROID_FG_SYNC_BOOTSTRAPPED_KEY = 'morgendrot.androidFgSync.bootstrapped'

export const DEFAULT_FG_SYNC_REASON =
  'Outbox & Direkt-RPC — WebView bleibt erreichbar'

import type { MessengerFgSyncPlugin } from '@/frontend/lib/capacitor-foreground-sync-types'

export type { MessengerFgSyncPlugin } from '@/frontend/lib/capacitor-foreground-sync-types'

const MessengerFgSync = registerPlugin<MessengerFgSyncPlugin>('MessengerFgSync', {
  web: () =>
    import('@/frontend/lib/capacitor-foreground-sync-web').then((m) => new m.MessengerFgSyncWeb()),
})

export function canUseAndroidForegroundSync(): boolean {
  return isCapacitorNativePlatform()
}

export function isAndroidFgSyncEnabled(): boolean {
  if (!canUseAndroidForegroundSync()) return false
  try {
    return window.localStorage.getItem(ANDROID_FG_SYNC_ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function setAndroidFgSyncEnabled(enabled: boolean): void {
  if (!canUseAndroidForegroundSync()) return
  try {
    if (enabled) {
      window.localStorage.setItem(ANDROID_FG_SYNC_ENABLED_KEY, '1')
    } else {
      window.localStorage.removeItem(ANDROID_FG_SYNC_ENABLED_KEY)
    }
  } catch {
    // optional
  }
}

/** Erstes APK-Öffnen: Opt-in standardmäßig an (§ H.6f, ohne periodischen Watchdog). */
export function bootstrapAndroidFgSyncPreference(): void {
  if (!canUseAndroidForegroundSync()) return
  try {
    if (window.localStorage.getItem(ANDROID_FG_SYNC_BOOTSTRAPPED_KEY) === '1') return
    window.localStorage.setItem(ANDROID_FG_SYNC_BOOTSTRAPPED_KEY, '1')
    if (window.localStorage.getItem(ANDROID_FG_SYNC_ENABLED_KEY) == null) {
      window.localStorage.setItem(ANDROID_FG_SYNC_ENABLED_KEY, '1')
    }
  } catch {
    // optional
  }
}

export async function startAndroidForegroundSyncIfEnabled(
  reason: string = DEFAULT_FG_SYNC_REASON
): Promise<{ started: boolean; running: boolean }> {
  if (!canUseAndroidForegroundSync() || !isAndroidFgSyncEnabled()) {
    return { started: false, running: false }
  }
  try {
    const res = await MessengerFgSync.start({ reason })
    return { started: res.ok, running: res.running }
  } catch {
    return { started: false, running: false }
  }
}

export async function stopAndroidForegroundSync(): Promise<void> {
  if (!canUseAndroidForegroundSync()) return
  try {
    await MessengerFgSync.stop()
  } catch {
    // optional
  }
}

export async function getAndroidForegroundSyncRunning(): Promise<boolean> {
  if (!canUseAndroidForegroundSync()) return false
  try {
    const state = await MessengerFgSync.getState()
    return state.running
  } catch {
    return false
  }
}
