'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Palette, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import {
  persistMagnetFeedbackEnabled,
  persistSoundFeedbackEnabled,
  persistSoundFeedbackVolume,
  readMagnetFeedbackEnabled,
  readSoundFeedbackEnabled,
  readSoundFeedbackVolume,
  UI_FEEDBACK_PREFS_CHANGED,
} from '@/frontend/lib/ui-feedback-prefs'
import { playTapClick } from '@/frontend/lib/ui-tap-feedback'

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
  const [soundOn, setSoundOn] = useState(() => readSoundFeedbackEnabled())
  const [soundVolume, setSoundVolume] = useState(() => readSoundFeedbackVolume())
  const [magnetOn, setMagnetOn] = useState(() => readMagnetFeedbackEnabled())

  useEffect(() => {
    const sync = () => {
      setSoundOn(readSoundFeedbackEnabled())
      setSoundVolume(readSoundFeedbackVolume())
      setMagnetOn(readMagnetFeedbackEnabled())
    }
    window.addEventListener(UI_FEEDBACK_PREFS_CHANGED, sync)
    return () => window.removeEventListener(UI_FEEDBACK_PREFS_CHANGED, sync)
  }, [])

  const selectPreset = useCallback((id: MessengerAppearanceId) => {
    setCustomOn(false)
    setActive(id)
    persistCustomAppearance(false)
    persistMessengerAppearance(id)
  }, [])

  const toggleCustom = useCallback(
    (on: boolean) => {
      setCustomOn(on)
      persistCustomAppearance(on, custom)
      if (!on) persistMessengerAppearance(active)
    },
    [active, custom]
  )

  const updateColor = useCallback(
    (key: keyof CustomAppearanceColors, value: string) => {
      const next = { ...custom, [key]: value }
      setCustom(next)
      if (customOn) persistCustomAppearance(true, next)
    },
    [custom, customOn]
  )

  const activePreset =
    MESSENGER_APPEARANCE_PRESETS.find((p) => p.id === active) ?? MESSENGER_APPEARANCE_PRESETS[0]

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Palette className="h-5 w-5 text-primary" aria-hidden />
        <h4 className="font-semibold text-foreground">Erscheinungsbild</h4>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Rahmen und Überschriften folgen den Tokens Hintergrund / Karte / Rahmen / Primär.
      </p>

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
                  value={
                    String(custom[key]).startsWith('#')
                      ? String(custom[key])
                      : (DEFAULT_CUSTOM_APPEARANCE[key] as string)
                  }
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
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-muted/40'
                  )}
                  aria-pressed={selected}
                >
                  {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
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

      <div className="mt-5 space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-primary" aria-hidden />
          <h5 className="text-sm font-semibold text-foreground">Klang &amp; Feedback</h5>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Klick-Ton optional. Magnet (Wii-Scale) ist experimentell und oft durch Layout abgeschnitten —
          Default aus. Besser erkennbar: klare Buttons, Unterstrich-Links, Fokusring.
        </p>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
          <Label htmlFor="ui-sound" className="text-sm text-foreground">
            Klick-Ton
          </Label>
          <Switch
            id="ui-sound"
            checked={soundOn}
            onCheckedChange={(on) => {
              setSoundOn(on)
              persistSoundFeedbackEnabled(on)
              if (on) playTapClick('soft')
            }}
          />
        </div>
        <div
          className={`space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2 ${soundOn ? '' : 'opacity-50'}`}
        >
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ui-sound-volume" className="text-sm text-foreground">
              Lautstärke
            </Label>
            <span className="tabular-nums text-xs text-muted-foreground">{soundVolume}%</span>
          </div>
          <input
            id="ui-sound-volume"
            type="range"
            min={0}
            max={100}
            step={5}
            value={soundVolume}
            disabled={!soundOn}
            data-no-tap-feedback="true"
            onInput={(e) => {
              const v = Number((e.target as HTMLInputElement).value)
              setSoundVolume(v)
              persistSoundFeedbackVolume(v)
            }}
            onChange={(e) => {
              const v = Number(e.target.value)
              setSoundVolume(v)
              persistSoundFeedbackVolume(v)
            }}
            onPointerUp={() => {
              if (soundOn && readSoundFeedbackVolume() > 0) playTapClick('soft')
            }}
            className="w-full accent-[var(--path-online)]"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={soundVolume}
          />
          <p className="text-[11px] text-muted-foreground">
            Nach dem Loslassen Probe-Ton. 0 = stumm, 100 = laut. Hard-Refresh falls der Regler noch stumm wirkt.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
          <Label htmlFor="ui-magnet" className="text-sm text-foreground">
            Magnet / Widerstand (Hover)
          </Label>
          <Switch
            id="ui-magnet"
            checked={magnetOn}
            onCheckedChange={(on) => {
              setMagnetOn(on)
              persistMagnetFeedbackEnabled(on)
            }}
          />
        </div>
      </div>
    </div>
  )
}
