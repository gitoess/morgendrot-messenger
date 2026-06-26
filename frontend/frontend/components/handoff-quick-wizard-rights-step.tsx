'use client'

import { cn } from '@/lib/utils'
import { getWizardCapabilityPresets } from '@/frontend/lib/handoff-capability-presets'
import type { MessengerCapabilitiesOverride } from '@morgendrot/shared/messenger-capabilities-matrix'

export function HandoffQuickWizardRightsStep(p: {
  selectedPresetId: string | null
  capabilitiesOverride: MessengerCapabilitiesOverride | null
  onSelectPreset: (id: string | null) => void
  onOpenExpert?: () => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Optional: Schnellprofil für Kanäle (LoRa, Telegram, IOTA). Ohne Auswahl gelten die Preset-Defaults
        (Helfer / Führer / Spezial).
      </p>
      <div className="space-y-2">
        <button
          type="button"
          aria-pressed={p.selectedPresetId === null}
          onClick={() => p.onSelectPreset(null)}
          className={cn(
            'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
            p.selectedPresetId === null
              ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
              : 'border-border/70 bg-muted/15 hover:bg-muted/25'
          )}
        >
          <span className="font-medium">Preset-Standard</span>
          <span className="mt-0.5 block text-[10px] text-muted-foreground">Keine Zusatz-Matrix</span>
        </button>
        {getWizardCapabilityPresets().map((cap) => {
          const active = p.selectedPresetId === cap.id
          return (
            <button
              key={cap.id}
              type="button"
              aria-pressed={active}
              onClick={() => p.onSelectPreset(cap.id)}
              className={cn(
                'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                active
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
                  : 'border-border/70 bg-muted/15 hover:bg-muted/25'
              )}
            >
              <span className="font-medium">{cap.label}</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">{cap.hint}</span>
            </button>
          )
        })}
      </div>
      {p.onOpenExpert ? (
        <button type="button" className="text-xs text-primary underline" onClick={p.onOpenExpert}>
          Volle Rechte-Matrix → Experten-Assistent
        </button>
      ) : null}
    </div>
  )
}
