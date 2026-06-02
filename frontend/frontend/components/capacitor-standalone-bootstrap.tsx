'use client'

import { useEffect } from 'react'
import { bootstrapCapacitorStandaloneSession } from '@/frontend/lib/capacitor-standalone-bootstrap'

/** Läuft einmal pro App-Start auf nativer Capacitor-Plattform. */
export function CapacitorStandaloneBootstrap() {
  useEffect(() => {
    bootstrapCapacitorStandaloneSession()
  }, [])
  return null
}
