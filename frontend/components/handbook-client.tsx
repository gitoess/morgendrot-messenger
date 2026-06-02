'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { HandbookMarkdown } from '@/components/handbook-markdown'

const DOCS: { file: string; title: string }[] = [
  { file: 'API-EINSATZ-ROLE-TEMPLATES.md', title: 'API: Einsatz-Rollen-Templates' },
  { file: 'BOSS-ORIENTIERUNG.md', title: 'Boss-Orientierung' },
  { file: 'DASHBOARD-ERSTE-SCHRITTE.md', title: 'Dashboard: Erste Schritte' },
  { file: 'DASHBOARD-PORT-UND-OBERFLAECHE.md', title: 'Dashboard: Ports & Oberflächen' },
  { file: 'TELEGRAM-INTEGRATION-EINRICHTUNG.md', title: 'Telegram einrichten' },
  { file: 'ONBOARDING-WALLET-UX-SPEC.md', title: 'Onboarding & Wallet (UX)' },
  { file: 'RECOVERY-PHRASE-BACKUP.md', title: 'Recovery Phrase / Backup' },
  { file: 'PWA-HANDBUCH-OFFLINE.md', title: 'PWA & Offline' },
  { file: 'NOTFALL-PURGE-MESSENGER.md', title: 'Notfall-Purge & lokaler Cache' },
  { file: 'VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md', title: 'Vault & Bild-Tarnung (Zielbild)' },
  { file: 'EINSATZ-VAULT-PURGE-PDF-REDUNDANZ-ZIELBILD.md', title: 'Einsatz: Purge, PDF, Redundanz' },
  { file: 'VAULT-TRAEGERBILD-EINSATZ-ORGANISATION.md', title: 'Trägerbild: Einsatz & Organisation' },
  { file: 'ROLLENWECHSEL-TEAM-EINSATZ.md', title: 'Rollenwechsel im Team (Einsatz)' },
  { file: 'MESSENGER-CHAT-HANDBUCH.md', title: 'Messenger (Chat)' },
  { file: 'VAULT-EINRICHTEN.md', title: 'Tresor einrichten' },
  { file: 'VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md', title: 'Messenger vs. Tresor' },
]

export function HandbookClient() {
  const [active, setActive] = useState(DOCS[0].file)
  const [body, setBody] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const f = new URLSearchParams(window.location.search).get('file')
      if (f && DOCS.some((d) => d.file === f)) setActive(f)
    } catch {
      /* ignore */
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
            Statische Markdown-Dateien — nach erstem Laden oft offline lesbar (Service Worker).
          </p>
        </div>
      </header>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:flex-row">
        <nav className="shrink-0 md:w-52">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Inhalt
          </p>
          <ul className="space-y-1">
            {DOCS.map((d) => (
              <li key={d.file}>
                <button
                  type="button"
                  onClick={() => setActive(d.file)}
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
              {error} — Ist <span className="font-mono">npm run sync:handbook</span> gelaufen und{' '}
              <span className="font-mono">frontend/public/handbook/</span> vorhanden?
            </p>
          ) : body ? (
            <HandbookMarkdown text={body} />
          ) : null}
        </article>
      </div>
    </div>
  )
}
