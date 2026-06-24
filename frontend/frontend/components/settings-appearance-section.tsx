'use client'

import { useCallback, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SettingsHandbookLink } from '@/frontend/components/settings-handbook-link'
import {
  DEFAULT_CUSTOM_APPEARANCE,
  DEFAULT_MESSENGER_APPEARANCE,
  MESSENGER_APPEARANCE_PRESETS,
  type CustomAppearanceColors,
  type MessengerAppearanceId,
  persistCustomAppearance,
  persistMessengerAppearance,
  readCustomAppearanceColors,
  readCustomAppearanceEnabled,
  readMessengerAppearanceId,
} from '@/frontend/lib/messenger-appearance-theme'

const COLOR_FIELDS: { key: keyof CustomAppearanceColors; label: string }[] = [
  { key: 'background', label: 'Hintergrund' },
  { key: 'primary', label: 'Primär' },
  { key: 'accent', label: 'Akzent' },
  { key: 'border', label: 'Rahmen' },
  { key: 'pathOnline', label: 'Online-Pfad' },
  { key: 'pathMesh', label: 'Funk-Pfad' },
  { key: 'pathTelegram', label: 'Telegram-Pfad' },
]

export function SettingsAppearanceSection() {
  const [active, setActive] = useState<MessengerAppearanceId>(() => readMessengerAppearanceId())
  const [customOn, setCustomOn] = useState(() => readCustomAppearanceEnabled())
  const [custom, setCustom] = useState<CustomAppearanceColors>(() => readCustomAppearanceColors())

  const selectPreset = useCallback((id: MessengerAppearanceId) => {
    setCustomOn(false)
    setActive(id)
    persistCustomAppearance(false)
    persistMessengerAppearance(id)
  }, [])

  const toggleCustom = useCallback((on: boolean) => {
    setCustomOn(on)
    persistCustomAppearance(on, custom)
    if (!on) persistMessengerAppearance(active)
  }, [active, custom])

  const updateColor = useCallback(
    (key: keyof CustomAppearanceColors, value: string) => {
      const next = { ...custom, [key]: value }
      setCustom(next)
      if (customOn) persistCustomAppearance(true, next)
    },
    [custom, customOn]
  )

  const activePreset = MESSENGER_APPEARANCE_PRESETS.find((p) => p.id === active) ?? MESSENGER_APPEARANCE_PRESETS[0]

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-[var(--path-online)]" aria-hidden />
          <h4 className="font-semibold text-foreground">Erscheinungsbild</h4>
        </div>
        <SettingsHandbookLink />
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
        <Label htmlFor="appearance-custom" className="text-sm text-foreground">
          Eigene Farben
        </Label>
        <Switch id="appearance-custom" checked={customOn} onCheckedChange={toggleCustom} />
      </div>

      {customOn ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="color"
                  value={String(custom[key]).startsWith('#') ? String(custom[key]) : DEFAULT_CUSTOM_APPEARANCE[key] as string}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  aria-label={label}
                />
                <span className="text-muted-foreground">{label}</span>
              </label>
            ))}
          </div>
          <label className="block text-sm">
            <span className="text-muted-foreground">Rahmenstärke</span>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
              value={custom.borderWidth}
              onChange={(e) =>
                updateColor('borderWidth', e.target.value as CustomAppearanceColors['borderWidth'])
              }
            >
              <option value="thin">Dünn</option>
              <option value="default">Normal</option>
              <option value="thick">Dick</option>
            </select>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {activePreset.swatches.map((hex) => (
              <span
                key={hex}
                className="h-7 w-7 rounded-md border border-border/60 shadow-sm"
                style={{ backgroundColor: hex }}
                aria-hidden
              />
            ))}
            <span className="text-sm font-medium text-foreground">{activePreset.label}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {MESSENGER_APPEARANCE_PRESETS.map((preset) => {
              const selected = active === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => selectPreset(preset.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    selected
                      ? 'border-[var(--path-online)] bg-[color-mix(in_oklab,var(--path-online)_8%,var(--card))]'
                      : 'border-border hover:bg-muted/40'
                  )}
                  aria-pressed={selected}
                >
                  {selected ? <Check className="h-4 w-4 shrink-0 text-[var(--path-online)]" /> : null}
                  {preset.label}
                </button>
              )
            })}
          </div>
          {active !== DEFAULT_MESSENGER_APPEARANCE ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => selectPreset(DEFAULT_MESSENGER_APPEARANCE)}
            >
              Auf Standard zurücksetzen
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
