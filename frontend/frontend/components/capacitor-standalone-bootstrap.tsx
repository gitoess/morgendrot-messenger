'use client'

import { useEffect } from 'react'
import { bootstrapCapacitorStandaloneSession } from '@/frontend/lib/capacitor-standalone-bootstrap'
import {
  clearStuckRadixBodyLock,
  isNativeVaultOverlayOpen,
  releaseStuckModalPointerEvents,
} from '@/frontend/lib/release-modal-pointer-events'

/** Läuft einmal pro App-Start auf nativer Capacitor-Plattform. */
export function CapacitorStandaloneBootstrap() {
  useEffect(() => {
    bootstrapCapacitorStandaloneSession()
    const sweep = () => {
      if (isNativeVaultOverlayOpen()) {
        clearStuckRadixBodyLock()
        return
      }
      releaseStuckModalPointerEvents({ force: true })
    }
    const t = window.setTimeout(sweep, 800)
    return () => window.clearTimeout(t)
  }, [])
  return null
}
