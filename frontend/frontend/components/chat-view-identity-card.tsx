'use client'

import { useCallback, useState } from 'react'
import { Check, Copy, User } from 'lucide-react'
import { cn } from '@/lib/utils'

function maskMid(addr: string): string {
  const t = addr.trim()
  if (t.length < 20) return t || '—'
  return `${t.slice(0, 10)}…${t.slice(-8)}`
}

/** M1 + M4d: Kontakt-ID und Mailbox-Übersicht. */
export function ChatViewIdentityCard(p: {
  myAddressLine: string
  compact?: boolean
  serverMailboxId?: string
}) {
  const full = (p.myAddressLine || '').trim()
  const valid = /^0x[a-fA-F0-9]{64}$/i.test(full)
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [full])

  if (!valid) return null

  if (p.compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs">
        <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">Deine Kontakt-ID:</span>
        <code className="font-mono text-[11px] text-foreground" title={full}>
          {maskMid(full)}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-accent"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-3 text-sm space-y-3">
      <div className="font-semibold text-foreground flex items-center gap-2">
        <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        Meine IOTA-Adresse (Kontakt-ID)
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <code
          className={cn(
            'block max-w-full overflow-x-auto rounded border border-border/60 bg-background/60 px-2 py-1.5 font-mono text-[11px] text-foreground'
          )}
        >
          {full}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Kopiert' : 'Adresse kopieren'}
        </button>
      </div>

      <div className="border-t border-border/60 pt-3">
        <p className="text-xs text-muted-foreground">
          Mailboxen (Server-Shared, Team, Privat) unter{' '}
          <span className="font-medium text-foreground">Einstellungen → Meine Mailboxen</span>.
        </p>
      </div>
    </div>
  )
}
