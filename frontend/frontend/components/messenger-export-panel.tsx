'use client'

import { useState } from 'react'
import { Package, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const BUNDLE_CMD = 'npm run bundle:messenger'
const BUNDLE_NOTE =
  'Erzeugt exports/Morgendrot-Messenger-standalone/ — Ordner kopieren, dort npm install && npm start.'

export function MessengerExportPanel({ className }: { className?: string }) {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card/80 p-4 text-sm shadow-sm',
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
        <Package className="h-4 w-4 text-primary" aria-hidden />
        Messenger exportieren
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{BUNDLE_NOTE}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-muted px-2 py-1 font-mono text-[11px]">{BUNDLE_CMD}</code>
        <button
          type="button"
          onClick={() => copy(BUNDLE_CMD, 'bundle')}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
        >
          {copied === 'bundle' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          Kopieren
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Lite-UI: Abschnitt „Messenger exportieren“ oder{' '}
        <span className="font-mono">POST /api/messenger-export-batch</span> (Stapel-Env für Geräte).
      </p>
    </div>
  )
}
