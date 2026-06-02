'use client'

import { Shield } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { formatActiveProfileTitle } from '@/frontend/lib/active-profile-display'
import { roleDisplayDe } from '@/frontend/lib/deployment-profile-theme'

type ActiveProfilePanelProps = {
  status: ApiStatus | null | undefined
}

/** Kurzzeile: „Aktives Profil: Boss“ — ohne Transport/Theme/Import-Details. */
export function ActiveProfilePanel({ status }: ActiveProfilePanelProps) {
  const role = roleDisplayDe(status?.role)
  const title = formatActiveProfileTitle(status)

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/35 bg-violet-500/10 text-violet-200">
        <Shield className="h-4 w-4" aria-hidden />
      </div>
      <p className="text-sm text-foreground">
        <span className="text-muted-foreground">Aktives Profil:</span>{' '}
        <span className="font-semibold">{status?.handoffLabel?.trim() ? title : role}</span>
      </p>
    </div>
  )
}
