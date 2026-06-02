'use client'

import { cn } from '@/lib/utils'
import {
  getComposerEncryptionContextHint,
  type ComposerEncryptionHintInput,
} from '@/frontend/lib/composer-encryption-context-hint'

export function ChatViewEncryptionContextHint(
  p: ComposerEncryptionHintInput & { className?: string; compact?: boolean }
) {
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
