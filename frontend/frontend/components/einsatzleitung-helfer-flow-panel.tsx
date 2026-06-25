'use client'

import { Package, Smartphone, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

export type HelferEinrichtenWizardStep = 'choose' | 'handoff' | 'join' | 'phonebook'

const FLOWS: {
  id: Exclude<HelferEinrichtenWizardStep, 'choose'>
  icon: typeof Package
  title: string
  body: string
}[] = [
  {
    id: 'handoff',
    icon: Package,
    title: 'Handoff-ZIP',
    body: 'Neues Gerät: ZIP + Seed-QR — Standardweg für Helfer mit vollständigem Profil.',
  },
  {
    id: 'join',
    icon: UserPlus,
    title: 'Spontan beitreten',
    body: 'Helfer ohne ZIP: Anfrage senden → du gibst frei → Team-Update an alle.',
  },
  {
    id: 'phonebook',
    icon: Smartphone,
    title: 'Telefonbuch',
    body: 'Kontakt manuell anlegen oder verteilen — z. B. nach Freigabe oder für Funk/Telegram-IDs.',
  },
]

export function EinsatzleitungHelferFlowPanel(p: {
  activeStep?: HelferEinrichtenWizardStep
  onSelectStep: (step: Exclude<HelferEinrichtenWizardStep, 'choose'>) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Schritt 1 — Methode wählen (ein Weg pro Helfer):</p>
      <div className="grid gap-2 sm:grid-cols-3" role="list">
        {FLOWS.map(({ id, icon: Icon, title, body }) => {
          const selected = p.activeStep === id
          return (
            <button
              key={id}
              type="button"
              role="listitem"
              aria-label={title}
              aria-pressed={selected}
              onClick={() => p.onSelectStep(id)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
                  : 'border-border/70 bg-muted/15 hover:border-primary/50 hover:bg-muted/25'
              )}
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                {title}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{body}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
