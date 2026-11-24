'use client'

/**
 * Next DevTools patcht `console.error` nach Hydration erneut.
 * Kurz reasserten, damit SDK-Packet-Logs nicht als „44 issues“ landen.
 */
import { useEffect } from 'react'
import {
  installMeshtasticConsoleErrorFilter,
  reassertMeshtasticConsoleErrorFilter,
} from '@/frontend/lib/meshtastic-console-error-filter'

export function MeshtasticDevNoiseGuard() {
  useEffect(() => {
    installMeshtasticConsoleErrorFilter()
    reassertMeshtasticConsoleErrorFilter()
    const ticks = [0, 50, 200, 500, 1000, 2000, 5000]
    const timers = ticks.map((ms) =>
      window.setTimeout(() => reassertMeshtasticConsoleErrorFilter(), ms)
    )
    const iv = window.setInterval(() => reassertMeshtasticConsoleErrorFilter(), 4000)
    const stop = window.setTimeout(() => clearInterval(iv), 120_000)
    return () => {
      for (const t of timers) clearTimeout(t)
      clearInterval(iv)
      clearTimeout(stop)
    }
  }, [])
  return null
}
