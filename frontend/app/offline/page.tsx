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
          <strong>Zielbild:</strong> Messenger <strong>Handy-first</strong>, <strong>local-first</strong>,{' '}
          <strong>direkt IOTA</strong> möglich; Morgendrot-Node <strong>optional</strong> — siehe{' '}
          <span className="font-mono text-xs">docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md</span>.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong>Übergang (heute):</strong> Diese PWA spricht oft noch mit <span className="font-mono text-xs">/api/*</span>{' '}
          auf einer erreichbaren Basis. Ohne Netz zur Basis sind viele Funktionen blockiert, bis der Client-Pfad
          weiter ausgebaut ist.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong>Wichtig bei Installation über</strong> <span className="font-mono text-xs">127.0.0.1</span> mit{' '}
          <span className="font-mono text-xs">adb reverse</span>: Ohne USB-Kabel zeigt{' '}
          <span className="font-mono text-xs">127.0.0.1</span> auf <em>dieses</em> Handy — der PC ist dann nicht
          erreichbar. Für Nutzung ohne Kabel (im Heim-WLAN): PWA von der <strong>WLAN-IP des PCs</strong> aus
          installieren (z. B. <span className="font-mono text-xs">http://192.168.…:3341</span>), solange dort{' '}
          <span className="font-mono text-xs">npm run start:prod:lan</span> läuft.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Die Handbuch-<strong>Markdown-Dateien</strong> unter <span className="font-mono text-xs">/handbook/*.md</span>{' '}
          können vom Service Worker gecacht werden; die Next-Seite <span className="font-mono text-xs">/handbook</span>{' '}
          lädt trotzdem zuerst wie jede Route die App von der Basis — ohne Netz zur Basis oft nicht nutzbar.
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
