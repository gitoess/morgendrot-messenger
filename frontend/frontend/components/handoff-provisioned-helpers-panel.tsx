'use client'

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HandoffProvisionRegistryMini } from '@/frontend/components/handoff-provision-registry-mini'
import { HandoffProvisionSeedRevealPanel } from '@/frontend/components/handoff-provision-seed-reveal-panel'
import { formatHandoffAddressShort } from '@/frontend/lib/handoff-export-display'
import { getHandoffPreset } from '@/frontend/lib/handoff-export-presets'
import {
  BOSS_PROVISION_REGISTRY_CHANGED_EVENT,
  countBossProvisionRegistryByStatus,
  getBossProvisionRegistryEntries,
  hasBossProvisionRegistry,
  isBossProvisionRegistryUnlocked,
  updateBossProvisionRegistryEntry,
} from '@/frontend/lib/boss-provision-registry'
import { useHandoffProvisionRegistryAccess } from '@/frontend/lib/handoff-provision-registry-access'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'
import { assignProvisionHelperMessengerGroup } from '@/frontend/lib/provision-helper-messenger-group'

/** Provisionierte Helfer (Custody B) — Teil von „Mein Team“ in der Einsatzleitung. */
export function HandoffProvisionedHelpersPanel(p: {
  refreshTick?: number
  onOpenExpert?: () => void
}) {
  const registry = useHandoffProvisionRegistryAccess()
  const [, bump] = useState(0)
  const refresh = useCallback(() => bump((n) => n + 1), [])

  useEffect(() => {
    if (p.refreshTick != null) bump((n) => n + 1)
  }, [p.refreshTick])

  // Registry kann in einem anderen Panel (z. B. Schnell-Assistent) entsperrt
  // oder erweitert werden — auf Änderungen reagieren.
  useEffect(() => {
    const onChanged = () => {
      registry.setRegistryReady(isBossProvisionRegistryUnlocked())
      refresh()
    }
    window.addEventListener(BOSS_PROVISION_REGISTRY_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(BOSS_PROVISION_REGISTRY_CHANGED_EVENT, onChanged)
  }, [registry.setRegistryReady, refresh])

  const registryExists = hasBossProvisionRegistry()
  const registryUnlocked = registry.registryUnlocked
  const entries = registryUnlocked ? getBossProvisionRegistryEntries() : []
  const stats = countBossProvisionRegistryByStatus(entries)
  const [revealEntryId, setRevealEntryId] = useState<string | null>(null)
  const messengerGroups = readMessengerGroups()

  if (!registryExists && !registryUnlocked) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Smartphone className="h-4 w-4 text-amber-500" aria-hidden />
          Provisionierte Helfer
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Noch keine Helfer mit <strong className="font-medium text-foreground">ZIP + Seed + QR</strong> angelegt.
          „Nur ZIP“ erscheint hier nicht — der Helfer verwaltet den Seed selbst. Neu anlegen:{' '}
          <a href="#helfer-einrichten" className="font-medium text-primary hover:underline">
            Helfer einrichten
          </a>{' '}
          → Handoff-ZIP.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Smartphone className="h-4 w-4 text-amber-500" aria-hidden />
          Provisionierte Helfer
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Einzelne Geräte/Wallets — nicht dasselbe wie{' '}
          <strong className="font-medium text-foreground">Team-Postfächer</strong> (IOTA-Mailboxen) unten.
        </p>

        {!registryUnlocked ? (
          <div className="mt-3">
            <HandoffProvisionRegistryMini
              registry={registry}
              onUnlocked={() => {
                refresh()
              }}
            />
          </div>
        ) : entries.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Registry leer — zuerst „ZIP + Seed + QR“ ausgeben.</p>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              {stats.total} Helfer · {stats.open} noch nicht übergeben · {stats.handedOver} übergeben
            </p>
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full min-w-[36rem] text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Bezeichnung</th>
                    <th className="px-3 py-2 font-medium">Wallet</th>
                    <th className="px-3 py-2 font-medium">Profil</th>
                    <th className="px-3 py-2 font-medium">Gruppe</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 16).map((e) => (
                    <tr key={e.id} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium text-foreground">{e.label}</td>
                      <td className="px-3 py-2 font-mono">{formatHandoffAddressShort(e.address)}</td>
                      <td className="px-3 py-2">{getHandoffPreset(e.presetId).label}</td>
                      <td className="px-3 py-2">
                        <select
                          className="max-w-[9rem] rounded border border-border bg-input px-1 py-0.5 text-[10px]"
                          value={e.messengerGroupId ?? ''}
                          onChange={(ev) => {
                            const groupId = ev.target.value.trim() || null
                            void assignProvisionHelperMessengerGroup({
                              entryId: e.id,
                              groupId,
                              helperAddress: e.address,
                            }).then((r) => {
                              if (r.ok) refresh()
                            })
                          }}
                        >
                          <option value="">—</option>
                          {messengerGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {e.handedOverAtIso ? 'Übergeben' : e.seedShownAtIso ? 'Seed gezeigt' : 'Erzeugt'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="rounded border border-border px-2 py-0.5 hover:bg-muted"
                            onClick={() => setRevealEntryId(e.id)}
                          >
                            Seed erneut anzeigen
                          </button>
                          {!e.handedOverAtIso ? (
                            <button
                              type="button"
                              className="rounded border border-border px-2 py-0.5 hover:bg-muted"
                              onClick={() => {
                                void updateBossProvisionRegistryEntry(e.id, {
                                  handedOverAtIso: new Date().toISOString(),
                                })
                                refresh()
                              }}
                            >
                              Übergeben
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {p.onOpenExpert ? (
          <button
            type="button"
            className="mt-3 text-xs font-medium text-primary hover:underline"
            onClick={p.onOpenExpert}
          >
            Registry sichern, Import, volle Matrix → Experten-Assistent
          </button>
        ) : null}
      </div>

      <Dialog open={!!revealEntryId} onOpenChange={(v) => !v && setRevealEntryId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" aria-hidden />
              Seed erneut anzeigen
            </DialogTitle>
            <DialogDescription>Nur Boss — Mnemonic nicht weiterleiten oder screenshotten.</DialogDescription>
          </DialogHeader>
          <HandoffProvisionSeedRevealPanel
            entryId={revealEntryId}
            resolveMasterPassword={() => registry.activeMasterPassword()}
            autoReveal
          />
          <Button type="button" variant="outline" className="w-full" onClick={() => setRevealEntryId(null)}>
            Schließen
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
