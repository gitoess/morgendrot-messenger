'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import { roleDisplayDe } from '@/frontend/lib/deployment-profile-theme'

function partnerLine(connected: number): string {
  if (connected === 0) return 'Keine Partner verbunden'
  if (connected === 1) return '1 Partner'
  return `${connected} Partner`
}

export function DashboardEinsatzSnapshot(p: {
  apiSnapshot: (ApiStatus & { error?: string }) | null
  variant?: 'default' | 'subtle'
}) {
  const label = p.apiSnapshot?.handoffLabel?.trim()
  const role = (p.apiSnapshot?.role || '').trim()
  const connected = p.apiSnapshot?.connectedAddresses?.length ?? 0
  const meta = [
    role ? `Rolle: ${roleDisplayDe(role)}` : null,
    partnerLine(connected),
  ]
    .filter(Boolean)
    .join(' · ')

  if (p.variant === 'subtle') {
    return (
      <section className="mb-1" aria-label="Aktueller Einsatz">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
          Aktueller Einsatz
        </p>
        {label ? (
          <p className="mt-0.5 text-xl font-semibold leading-tight text-foreground">{label}</p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground/50">Keine Bezeichnung</p>
        )}
        {meta ? <p className="mt-1 text-xs text-muted-foreground">{meta}</p> : null}
      </section>
    )
  }

  return (
    <section
      className="mb-5 rounded-xl border border-border/80 bg-card/50 px-4 py-3"
      aria-label="Aktueller Einsatz"
    >
      <h2 className="sr-only">Aktueller Einsatz</h2>
      <p className="text-base font-semibold text-foreground">{label || 'Einsatz ohne Bezeichnung'}</p>
      <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
    </section>
  )
}
