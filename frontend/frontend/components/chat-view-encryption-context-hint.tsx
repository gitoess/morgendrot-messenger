'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
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
  if (!text) return null

  return (
    <p
      role="note"
      className={cn(
        'leading-snug text-muted-foreground',
        p.compact ? 'text-[10px]' : 'rounded-md border border-border/60 bg-muted/25 px-2.5 py-1.5 text-[11px]',
        p.className
      )}
    >
      {text}
    </p>
  )
}
