'use client'

import type { ApiStatus } from '@/frontend/lib/api/status'
import { formatActiveProfileTitle } from '@/frontend/lib/active-profile-display'
import { resolveDeploymentProfileTheme } from '@/frontend/lib/deployment-profile-theme'
import { cn } from '@/lib/utils'

type ActiveProfileBadgeProps = {
  status: Pick<ApiStatus, 'handoffLabel' | 'role' | 'deploymentProfile' | 'transportProfile'> | null | undefined
  compact?: boolean
  className?: string
}

/** Kopfzeilen-Badge: „THW Einsatz Süd – Arbeiter“. */
export function ActiveProfileBadge({ status, compact, className }: ActiveProfileBadgeProps) {
  const theme = resolveDeploymentProfileTheme(status)
  const title = formatActiveProfileTitle(status)
  if (!status?.role && !status?.handoffLabel) return null

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold leading-tight',
        theme.badgeClass,
        className
      )}
      title={`Aktives Profil · Theme ${theme.label}`}
    >
      {!compact ? (
        <span className="truncate">{title}</span>
      ) : (
        <>
          <span className="shrink-0 font-bold">{theme.watermark}</span>
          <span className="truncate">{status?.role ? title.split(' – ').pop() : title}</span>
        </>
      )}
    </span>
  )
}
