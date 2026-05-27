'use client'

import {
  describeRoleIdBits,
  HANDOFF_ROLE_BIT_UI,
  HANDOFF_ROLE_ID_PRESETS,
  roleIdHasBit,
  setRoleIdBit,
  type HandoffRoleBitKey,
} from '@/frontend/lib/handoff-role-id-bits'
import { cn } from '@/lib/utils'

export type HandoffRoleIdBitPickerProps = {
  /** Aktive ROLE_ID (Preset oder Override). */
  effectiveRoleId: number
  /** ROLE_ID der gewählten Basis-Karte ohne Override. */
  presetRoleId: number
  /** `null` = Basis-Profil; Zahl = Boss hat Bits angepasst. */
  tuningRoleId: number | null
  onTuningRoleIdChange: (roleId: number | null) => void
  className?: string
}

export function HandoffRoleIdBitPicker(p: HandoffRoleIdBitPickerProps) {
  const hasOverride = p.tuningRoleId != null
  const showSendWarning = !roleIdHasBit(p.effectiveRoleId, 'S')

  const toggleBit = (key: HandoffRoleBitKey, checked: boolean) => {
    const base = p.tuningRoleId ?? p.presetRoleId
    const next = setRoleIdBit(base, key, checked)
    p.onTuningRoleIdChange(next === p.presetRoleId ? null : next)
  }

  const applyQuickPreset = (id: number) => {
    p.onTuningRoleIdChange(id === p.presetRoleId ? null : id)
  }

  return (
    <div className={cn('space-y-3', p.className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">ROLE_ID = {p.effectiveRoleId}</span>
          <span className="ml-1.5 font-mono">({describeRoleIdBits(p.effectiveRoleId)})</span>
        </p>
        {hasOverride ? (
          <button
            type="button"
            className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
            onClick={() => p.onTuningRoleIdChange(null)}
          >
            Zurück auf Basis ({p.presetRoleId})
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">wie Basis-Profil ({p.presetRoleId})</span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {HANDOFF_ROLE_BIT_UI.map((bit) => (
          <label
            key={bit.key}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={roleIdHasBit(p.effectiveRoleId, bit.key)}
              onChange={(e) => toggleBit(bit.key, e.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">{bit.label}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{bit.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {showSendWarning ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-950 dark:text-amber-50">
          <strong>S-Bit aus:</strong> Senden, Heartbeat und .morg-pkg-Export sind für diese ROLE_ID deaktiviert
          (Backend prüft Bit <span className="font-mono">S</span>).
        </p>
      ) : null}

      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Schnellwahl (Lite-UI-Profile)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {HANDOFF_ROLE_ID_PRESETS.map((quick) => {
            const active = p.effectiveRoleId === quick.id
            return (
              <button
                key={quick.id}
                type="button"
                title={`ROLE_ID=${quick.id} · ${quick.bits}`}
                onClick={() => applyQuickPreset(quick.id)}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                  active
                    ? 'border-purple-400/60 bg-purple-500/20 text-foreground'
                    : 'border-border/70 bg-muted/20 text-muted-foreground hover:bg-muted/40'
                )}
              >
                {quick.label}
                <span className="ml-1 font-mono text-[10px] opacity-80">{quick.id}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
