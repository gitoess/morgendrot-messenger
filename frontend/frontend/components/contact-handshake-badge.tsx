'use client'

import { cn } from '@/lib/utils'
import type { ContactHandshakeBadgeKind } from '@/frontend/lib/contact-handshake-ui'
import { contactHandshakeBadgeLabel } from '@/frontend/lib/contact-handshake-ui'
import { Lock, ShieldAlert, ShieldCheck } from 'lucide-react'

export function ContactHandshakeBadge(p: {
  kind: ContactHandshakeBadgeKind
  compact?: boolean
  className?: string
}) {
  const label = contactHandshakeBadgeLabel(p.kind)
  if (!label || p.kind === 'none') return null

  const Icon = p.kind === 'ready' ? ShieldCheck : p.kind === 'pending' ? Lock : ShieldAlert
  const tone =
    p.kind === 'ready'
      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : p.kind === 'pending'
        ? 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200'
        : 'border-orange-500/35 bg-orange-500/10 text-orange-800 dark:text-orange-200'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-none',
        tone,
        p.className
      )}
      title={label}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {p.compact ? null : <span>{label}</span>}
    </span>
  )
}
