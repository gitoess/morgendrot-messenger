'use client'

import { useEffect } from 'react'

/**
 * Registriert /sw.js nur in Production (Dev: kein SW – vermeidet Konflikte mit next dev / HMR).
 */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // Dev-Schutz: alte PWA-Service-Worker von vorherigen Prod-Läufen entfernen,
      // damit next dev/HMR keine stale Chunk-Dateien serviert.
      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map((r) => r.unregister()))
        } catch {
          /* ignore */
        }
      })()
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        if (cancelled) return
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (installing) {
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                /* neue Version bereit – kein Auto-Reload, Nutzer lädt neu */
              }
            })
          }
        })
      } catch {
        /* z. B. unsicheres Kontext ohne HTTPS (außer localhost) */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
