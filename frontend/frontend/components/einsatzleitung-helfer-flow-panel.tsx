'use client'

import { Package, Smartphone, UserPlus } from 'lucide-react'

const FLOWS = [
  {
    icon: Package,
    title: 'Handoff-ZIP (geplant)',
    body: 'Boss exportiert Profil, Rechte, Team, Partner. Helfer importiert lokal — schnellster Standardweg.',
  },
  {
    icon: UserPlus,
    title: 'Spontan beitreten',
    body: 'Helfer ohne ZIP: Beitrittsanfrage → Boss freigibt → Team-Update an alle (Telegram/Funk-IDs mit).',
  },
  {
    icon: Smartphone,
    title: 'Telefonbuch',
    body: 'Kontakt anlegen (oder nach Freigabe übernehmen) → initialProfile JSON oder verschl. Mesh-Backup.',
  },
] as const

/** Drei Wege: Handoff, Join-Request, Telefonbuch — kompakt ohne Langtext. */
export function EinsatzleitungHelferFlowPanel() {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {FLOWS.map(({ icon: Icon, title, body }) => (
        <div key={title} className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            {title}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{body}</p>
        </div>
      ))}
    </div>
  )
}
