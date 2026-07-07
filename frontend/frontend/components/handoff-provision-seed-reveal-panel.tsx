'use client'

import { useCallback, useEffect, useState } from 'react'
import { EyeOff, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getBossProvisionRegistryEntries,
  isBossProvisionRegistryUnlocked,
  revealBossProvisionSeed,
  type BossProvisionRegistryEntry,
} from '@/frontend/lib/boss-provision-registry'

/** Seed aus Boss-Registry für einen Provision-Eintrag anzeigen. */
export function HandoffProvisionSeedRevealPanel(p: {
  entryId: string | null
  resolveMasterPassword: () => string
  resolveEntry?: (entryId: string) => BossProvisionRegistryEntry | undefined
  className?: string
  /** Dialog-Modus: Seed sofort laden (nach Klick „Seed erneut anzeigen“). */
  autoReveal?: boolean
  /** Button-Text — Standard: Seed erneut anzeigen */
  revealLabel?: string
}) {
  const [revealedSeed, setRevealedSeed] = useState('')
  const [revealError, setRevealError] = useState('')
  const [revealBusy, setRevealBusy] = useState(false)
  const entryId = p.entryId

  const onReveal = useCallback(async () => {
    if (!entryId) return
    setRevealError('')
    setRevealedSeed('')
    const password = p.resolveMasterPassword().trim()
    // Leeres Passwort ist ok, wenn die Registry in dieser Session bereits
    // entsperrt wurde — revealBossProvisionSeed nutzt dann das Session-Passwort.
    if (!password && !isBossProvisionRegistryUnlocked()) {
      setRevealError('Registry ist gesperrt — Master-Passwort eingeben.')
      return
    }
    const entry =
      p.resolveEntry?.(entryId) ?? getBossProvisionRegistryEntries().find((e) => e.id === entryId)
    if (!entry) {
      setRevealError('Registry-Eintrag nicht gefunden.')
      return
    }
    setRevealBusy(true)
    const revealed = await revealBossProvisionSeed(entry, password)
    setRevealBusy(false)
    if (!revealed.ok) {
      setRevealError(revealed.error)
      return
    }
    setRevealedSeed(revealed.seedImport)
  }, [entryId, p.resolveEntry, p.resolveMasterPassword])

  useEffect(() => {
    if (!p.autoReveal || !entryId) return
    void onReveal()
  }, [p.autoReveal, entryId, onReveal])

  if (!entryId) return null

  const revealLabel = p.revealLabel ?? 'Seed erneut anzeigen'

  return (
    <div className={p.className}>
      {revealedSeed ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium text-foreground">Seed (Registry — nur Boss)</p>
          <textarea
            readOnly
            value={revealedSeed}
            className="min-h-[5rem] w-full rounded-lg border border-border bg-background p-2 font-mono text-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setRevealedSeed('')}>
            <EyeOff className="mr-2 h-4 w-4" aria-hidden />
            Seed ausblenden
          </Button>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" disabled={revealBusy} onClick={() => void onReveal()}>
          <KeyRound className="mr-2 h-4 w-4" aria-hidden />
          {revealBusy ? 'Entschlüssele…' : revealLabel}
        </Button>
      )}
      {revealError ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {revealError}
        </p>
      ) : null}
    </div>
  )
}
