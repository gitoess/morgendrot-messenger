'use client'

import { cn } from '@/lib/utils'
import { roleDisplayDe } from '@/frontend/lib/deployment-profile-theme'

export function DashboardRolePill({ role, className }: { role?: string | null; className?: string }) {
  const r = (role || '').trim().toLowerCase()
  const label = roleDisplayDe(role || undefined)
  if (!label || label === '—') return null

  const pillClass =
    r === 'boss'
      ? 'border-violet-500/45 bg-violet-500/15 text-violet-800 dark:text-violet-200'
      : r === 'kommandant'
        ? 'border-amber-500/45 bg-amber-500/15 text-amber-900 dark:text-amber-200'
        : 'border-border bg-muted/80 text-muted-foreground'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none',
        pillClass,
        className
      )}
    >
      {label}
    </span>
  )
}
