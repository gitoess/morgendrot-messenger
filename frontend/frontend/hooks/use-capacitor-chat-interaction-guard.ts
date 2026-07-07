'use client'

import { useLayoutEffect } from 'react'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import {
  clearStuckRadixBodyLock,
  isNativeVaultOverlayOpen,
  purgeOrphanRadixOverlays,
  releaseStuckModalPointerEvents,
} from '@/frontend/lib/release-modal-pointer-events'

const SWEEP_MS = 350

/** APK: Nachrichten-View — hängende Radix-/Body-Locks bereinigen (Tresor → Chat). */
export function useCapacitorChatInteractionGuard(enabled: boolean): void {
  useLayoutEffect(() => {
    if (!enabled || !isCapacitorNativePlatform()) return

    const sweep = () => {
      purgeOrphanRadixOverlays()
      if (isNativeVaultOverlayOpen()) {
        clearStuckRadixBodyLock()
        return
      }
      releaseStuckModalPointerEvents({ force: true })
    }

    sweep()
    const id = window.setInterval(sweep, SWEEP_MS)
    return () => window.clearInterval(id)
  }, [enabled])
}
