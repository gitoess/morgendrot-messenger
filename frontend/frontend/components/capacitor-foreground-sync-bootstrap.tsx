'use client'

import { useEffect } from 'react'
import {
  bootstrapAndroidFgSyncPreference,
  startAndroidForegroundSyncIfEnabled,
} from '@/frontend/lib/capacitor-foreground-sync'

/** § H.6f — startet FG-Service auf APK wenn Opt-in aktiv (kein periodischer Poll). */
export function CapacitorForegroundSyncBootstrap() {
  useEffect(() => {
    bootstrapAndroidFgSyncPreference()
    void startAndroidForegroundSyncIfEnabled()
  }, [])
  return null
}
