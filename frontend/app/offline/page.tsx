'use client'

import Link from 'next/link'

/**
 * PWA-Fallback (§ H.2): bei Navigation ohne Netz liefert der Service Worker diese Route aus dem Cache.
 * Kein Dashboard/API — schlanke Shell ohne Backend.
 */
export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">Keine Netzverbindung</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Die Basis-API (<span className="font-mono text-xs">/api/*</span>) ist offline nicht erreichbar. Bereits
          geladene App-Teile und das Handbuch können nach vorherigem Besuch aus dem Cache nutzbar sein.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm justify-center">
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => window.location.reload()}
        >
          Erneut versuchen
        </button>
        <Link
          href="/handbook"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-muted/50 px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Handbuch
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Zur Startseite
        </Link>
      </div>
    </main>
  )
}
