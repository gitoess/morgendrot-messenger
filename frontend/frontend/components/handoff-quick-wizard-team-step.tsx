'use client'

import { useMemo } from 'react'
import type { ApiStatus } from '@/frontend/lib/api'
import { buildTeamMailboxOptions } from '@/frontend/lib/handoff-export-autofill'
import { handoffPresetUsesTeamMailboxes } from '@/frontend/lib/handoff-export-presets'
import type { HandoffEinsatzPresetId } from '@/frontend/lib/handoff-export-presets'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

export function HandoffQuickWizardTeamStep(p: {
  apiSnapshot?: ApiStatus | null
  presetId: HandoffEinsatzPresetId
  selectedTeamIds: string[]
  onToggleTeamId: (id: string) => void
  onOpenExpert?: () => void
}) {
  const teamMailboxOptions = useMemo(
    () => buildTeamMailboxOptions(p.apiSnapshot ?? null, readMyTeamMailboxes()),
    [p.apiSnapshot]
  )
  const usesTeam = handoffPresetUsesTeamMailboxes(p.presetId, false)

  if (!usesTeam) {
    return (
      <p className="text-sm text-muted-foreground">
        Preset ohne Team-Postfächer — Schritt überspringbar.
      </p>
    )
  }

  if (!teamMailboxOptions.length) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-amber-600 dark:text-amber-400">
          Keine Team-Mailbox konfiguriert. Lege zuerst ein Postfach an oder nutze den Experten-Assistenten.
        </p>
        {p.onOpenExpert ? (
          <button type="button" className="text-xs text-primary underline" onClick={p.onOpenExpert}>
            Experten-Assistent öffnen
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Welche Team-Postfächer sollen im Handoff enthalten sein? (Standard: alle vorausgewählt)
      </p>
      <ul className="max-h-48 space-y-1.5 overflow-y-auto">
        {teamMailboxOptions.map((opt) => (
          <li key={opt.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={p.selectedTeamIds.includes(opt.id)}
                onChange={() => p.onToggleTeamId(opt.id)}
              />
              <span className="min-w-0 flex-1 font-medium text-foreground">{opt.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {maskWalletAddress(opt.id, 6, 4)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
