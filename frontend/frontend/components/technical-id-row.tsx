'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { copyTextSafe } from '@/frontend/lib/copy-text-safe'
import { cn } from '@/lib/utils'

export type TechnicalIdRowProps = {
  label: string
  value: string
  /** Optional hint under the value (e.g. „nicht kopierbar“). */
  hint?: string
  /** If false, value is shown but copy is disabled. */
  copyable?: boolean
  className?: string
  /** Compact mono truncation for long hex — full value still copyable. */
  truncate?: boolean
  /** Explorer / externe Detailseite. */
  href?: string
  hrefLabel?: string
}

/** Einheitliche ID/Key/TX-Zeile mit sicherem Kopieren. */
export function TechnicalIdRow(p: TechnicalIdRowProps) {
  const value = p.value.trim()
  const [copied, setCopied] = useState(false)
  if (!value) return null
  const copyable = p.copyable !== false

  return (
    <div className={cn('space-y-0.5', p.className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{p.label}</p>
      <div className="flex items-start gap-2">
        <p
          className={cn(
            'min-w-0 flex-1 break-all font-mono text-[11px] text-foreground',
            p.truncate && value.length > 20 && 'truncate'
          )}
          title={value}
        >
          {value}
        </p>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {copyable ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              onClick={() => {
                void (async () => {
                  const r = await copyTextSafe(value)
                  if (!r.ok) return
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1600)
                })()
              }}
            >
              {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
              {copied ? 'Kopiert' : 'Kopieren'}
            </button>
          ) : null}
          {p.href ? (
            <a
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline"
            >
              {p.hrefLabel || 'Explorer'}
            </a>
          ) : null}
        </div>
      </div>
      {p.hint ? <p className="text-[10px] text-muted-foreground">{p.hint}</p> : null}
    </div>
  )
}

export type TechnicalIdSectionProps = {
  title: string
  children: React.ReactNode
  emptyHint?: string
  className?: string
}

export function TechnicalIdSection(p: TechnicalIdSectionProps) {
  return (
    <section className={cn('space-y-2', p.className)}>
      <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
      <div className="space-y-2.5 rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5">
        {p.children}
      </div>
      {p.emptyHint ? <p className="text-[11px] text-muted-foreground">{p.emptyHint}</p> : null}
    </section>
  )
}
