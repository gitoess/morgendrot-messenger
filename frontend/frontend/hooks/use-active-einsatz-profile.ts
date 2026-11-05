'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  PACKAGE_PROFILE_REGISTRY_CHANGED,
  readActiveProfileSnapshot,
  type ActiveProfileSnapshot,
} from '@/frontend/lib/package-profile-registry'

/** Reaktives aktives Einsatzprofil (§ H.24b Adoption — Banner, Inbox). */
export function useActiveEinsatzProfile(): ActiveProfileSnapshot | undefined {
  const [snap, setSnap] = useState<ActiveProfileSnapshot | undefined>(() =>
    typeof window === 'undefined' ? undefined : readActiveProfileSnapshot()
  )

  const refresh = useCallback(() => {
    setSnap(readActiveProfileSnapshot())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener(PACKAGE_PROFILE_REGISTRY_CHANGED, refresh)
    return () => window.removeEventListener(PACKAGE_PROFILE_REGISTRY_CHANGED, refresh)
  }, [refresh])

  return snap
}
