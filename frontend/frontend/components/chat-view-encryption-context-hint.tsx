'use client'

import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  composerWillUseDoubleRatchet,
  getComposerEncryptionContextHint,
  type ComposerEncryptionHintInput,
} from '@/frontend/lib/composer-encryption-context-hint'
import { RATCHET_EXPERIMENT_CHANGED } from '@/frontend/lib/ratchet-experiment'

export function ChatViewEncryptionContextHint(
  p: ComposerEncryptionHintInput & { className?: string; compact?: boolean }
) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const sync = () => setTick((n) => n + 1)
    window.addEventListener(RATCHET_EXPERIMENT_CHANGED, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(RATCHET_EXPERIMENT_CHANGED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const text = getComposerEncryptionContextHint(p)
  const ratchetOn = composerWillUseDoubleRatchet(p)
  if (!text && !ratchetOn) return null

  return (
    <div
      role="note"
      className={cn(
        'leading-snug text-muted-foreground',
        p.compact ? 'text-[10px]' : 'rounded-md border border-border/60 bg-muted/25 px-2.5 py-1.5 text-[11px]',
        ratchetOn && !p.compact && 'border-amber-500/40 bg-amber-500/10',
        p.className
      )}
    >
      {ratchetOn ? (
        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-semibold text-amber-950 dark:text-amber-100">
          <FlaskConical className="h-3 w-3 shrink-0" aria-hidden />
          Double Ratchet aktiv
        </span>
      ) : null}
      {text ? <p className={cn(ratchetOn && 'mt-1')}>{text}</p> : null}
    </div>
  )
}
