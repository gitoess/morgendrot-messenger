'use client'

import { useCallback, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_MESSENGER_APPEARANCE,
  MESSENGER_APPEARANCE_PRESETS,
  type MessengerAppearanceId,
  persistMessengerAppearance,
  readMessengerAppearanceId,
} from '@/frontend/lib/messenger-appearance-theme'

export function SettingsAppearanceSection() {
  const [active, setActive] = useState<MessengerAppearanceId>(() => readMessengerAppearanceId())

  const select = useCallback((id: MessengerAppearanceId) => {
    setActive(id)
    persistMessengerAppearance(id)
  }, [])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--path-online)_18%,transparent)] text-[var(--path-online)]">
          <Palette className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-foreground">Erscheinungsbild</h4>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Farben und Kontrast — wird in diesem Browser gespeichert. Standard = ziviles Dienst-UI, Taktisch =
            Oliv/Amber (NVG), Hoher Kontrast = Schwarz/Weiß für Blendung.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {MESSENGER_APPEARANCE_PRESETS.map((preset) => {
          const selected = active === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => select(preset.id)}
              className={cn(
                'relative flex flex-col rounded-xl border-2 p-3 text-left transition-colors',
                selected
                  ? 'border-[var(--path-online)] bg-[color-mix(in_oklab,var(--path-online)_8%,var(--card))]'
                  : 'border-border bg-muted/20 hover:bg-muted/40'
              )}
              aria-pressed={selected}
            >
              {selected ? (
                <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--path-online)] text-white">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
              ) : null}
              <div className="mb-2 flex gap-1">
                {preset.swatches.map((hex) => (
                  <span
                    key={hex}
                    className="h-6 w-6 rounded-md border border-border/60 shadow-sm"
                    style={{ backgroundColor: hex }}
                    aria-hidden
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-foreground">{preset.label}</span>
              <span className="mt-0.5 text-xs leading-snug text-muted-foreground">{preset.description}</span>
            </button>
          )
        })}
      </div>
      {active !== DEFAULT_MESSENGER_APPEARANCE ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Aktiv: <strong className="font-medium text-foreground">{active}</strong> — Einsatz-Branding (THW/POL
          Badge) bleibt zusätzlich sichtbar.
        </p>
      ) : null}
    </div>
  )
}
