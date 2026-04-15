'use client'

/**
 * PWA-Installation — auf dem **Haupt-Dashboard** (nicht nur in den Einstellungen), damit „App auf den Startbildschirm“ auffindbar ist.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Smartphone } from 'lucide-react'

type DeferredPwaPrompt = {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function DashboardPwaInstallCard() {
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<DeferredPwaPrompt | null>(null)
  const [pwaStandalone, setPwaStandalone] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(display-mode: standalone)')
    const syncStandalone = () => {
      setPwaStandalone(
        mq.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      )
    }
    syncStandalone()
    mq.addEventListener('change', syncStandalone)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPwaPrompt(e as unknown as DeferredPwaPrompt)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => {
      mq.removeEventListener('change', syncStandalone)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  const handlePwaInstallClick = async () => {
    if (!deferredPwaPrompt) return
    try {
      await deferredPwaPrompt.prompt()
      await deferredPwaPrompt.userChoice
    } finally {
      setDeferredPwaPrompt(null)
    }
  }

  if (pwaStandalone) return null

  return (
    <div id="dashboard-pwa-install" className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Smartphone className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h4 className="font-semibold text-foreground">App auf den Startbildschirm</h4>
          <p className="text-sm text-muted-foreground">
            Installierte PWAs starten ohne Browser-Leiste. Auf <strong className="text-foreground">iPhone/iPad</strong>{' '}
            (Safari): Teilen-Menü → <strong className="text-foreground">Zum Home-Bildschirm</strong>.
          </p>
          {deferredPwaPrompt ? (
            <button
              type="button"
              onClick={() => void handlePwaInstallClick()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Installation anbieten
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Wenn der Browser eine Installation erlaubt (meist HTTPS oder localhost), erscheint hier ein Button – sonst
              Browser-Menü „App installieren“ nutzen.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            <Link href="/handbook" className="text-primary underline hover:no-underline">
              Handbuch (Offline-Hinweise)
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
