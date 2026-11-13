'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { HandbookMarkdown } from '@/components/handbook-markdown'

/** Messenger-zuerst; Specs/Zielbilder weiter unten. Default = Chat-Handbuch. */
const DOCS: { file: string; title: string; group?: string }[] = [
  { file: 'MESSENGER-CHAT-HANDBUCH.md', title: '1 · Messenger (Chat)', group: 'Messenger' },
  { file: 'EINSTELLUNGEN-NUTZER-HANDBUCH.md', title: '2 · Einstellungen', group: 'Messenger' },
  { file: 'TELEGRAM-INTEGRATION-EINRICHTUNG.md', title: 'Telegram einrichten', group: 'Messenger' },
  { file: 'VAULT-EINRICHTEN.md', title: 'Tresor einrichten', group: 'Messenger' },
  { file: 'VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md', title: 'Messenger vs. Tresor', group: 'Messenger' },
  { file: 'DASHBOARD-ERSTE-SCHRITTE.md', title: 'Dashboard: Erste Schritte', group: 'Start' },
  { file: 'DASHBOARD-PORT-UND-OBERFLAECHE.md', title: 'Dashboard: Ports', group: 'Start' },
  { file: 'STANDALONE-HANDY-SCHNELLSTART.md', title: 'Standalone Handy', group: 'Start' },
  { file: 'BOSS-ORIENTIERUNG.md', title: 'Boss-Orientierung', group: 'Einsatz' },
  { file: 'NOTFALL-PURGE-MESSENGER.md', title: 'Notfall-Purge', group: 'Einsatz' },
  { file: 'RECOVERY-PHRASE-BACKUP.md', title: 'Recovery Phrase', group: 'Einsatz' },
  { file: 'PWA-HANDBUCH-OFFLINE.md', title: 'PWA & Offline', group: 'Technik' },
  { file: 'ONBOARDING-WALLET-UX-SPEC.md', title: 'Onboarding & Wallet (Spec)', group: 'Technik' },
  { file: 'API-EINSATZ-ROLE-TEMPLATES.md', title: 'API: Rollen-Templates', group: 'Technik' },
  { file: 'VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md', title: 'Vault Bild-Tarnung (Ziel)', group: 'Zielbilder' },
  { file: 'EINSATZ-VAULT-PURGE-PDF-REDUNDANZ-ZIELBILD.md', title: 'Purge/PDF/Redundanz (Ziel)', group: 'Zielbilder' },
  { file: 'VAULT-TRAEGERBILD-EINSATZ-ORGANISATION.md', title: 'Trägerbild Organisation', group: 'Zielbilder' },
  { file: 'ROLLENWECHSEL-TEAM-EINSATZ.md', title: 'Rollenwechsel', group: 'Zielbilder' },
]

const DEFAULT_FILE = 'MESSENGER-CHAT-HANDBUCH.md'

export function HandbookClient() {
  const [active, setActive] = useState(DEFAULT_FILE)
  const [body, setBody] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const f = new URLSearchParams(window.location.search).get('file')
      if (f && DOCS.some((d) => d.file === f)) setActive(f)
      else setActive(DEFAULT_FILE)
    } catch {
      setActive(DEFAULT_FILE)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setBody(null)
    void (async () => {
      try {
        const r = await fetch('/handbook/' + active, { cache: 'no-store' })
        if (!r.ok) throw new Error('HTTP ' + r.status)
        const t = await r.text()
        if (!cancelled) setBody(t)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [active])

  useEffect(() => {
    if (!body || loading) return
    const id = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
    if (!id) return
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [body, loading, active])

  const selectDoc = (file: string) => {
    setActive(file)
    try {
      const u = new URL(window.location.href)
      u.searchParams.set('file', file)
      window.history.replaceState({}, '', u.toString())
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-cyan-500/90" aria-hidden />
            <h1 className="text-lg font-semibold">Handbuch</h1>
          </div>
          <p className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
            Zwei Einstiege: <strong className="text-foreground">Messenger (Chat)</strong> und{' '}
            <strong className="text-foreground">Einstellungen</strong>. Links gehen zur Aktion — nicht umgekehrt.
          </p>
        </div>
      </header>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:flex-row">
        <nav className="shrink-0 md:w-56">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Inhalt
          </p>
          <ul className="space-y-1">
            {DOCS.map((d) => (
              <li key={d.file}>
                <button
                  type="button"
                  onClick={() => selectDoc(d.file)}
                  className={
                    'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ' +
                    (active === d.file
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                  }
                >
                  {d.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <article className="min-w-0 flex-1 rounded-xl border border-border bg-card/30 p-4 md:p-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : error ? (
            <p className="text-sm text-destructive">
              Konnte „{active}“ nicht laden ({error}). Datei unter{' '}
              <span className="font-mono">/handbook/{active}</span> prüfen.
            </p>
          ) : body ? (
            <HandbookMarkdown text={body} />
          ) : null}
        </article>
      </div>
    </div>
  )
}
