'use client'

import { useCallback, useRef, useState } from 'react'
import { EyeOff, KeyRound, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatHandoffAddressShort } from '@/frontend/lib/handoff-export-display'
import { getHandoffPreset } from '@/frontend/lib/handoff-export-presets'
import {
  countBossProvisionRegistryByStatus,
  downloadBossProvisionRegistryBackup,
  getBossProvisionRegistryEntries,
  importBossProvisionRegistryBackup,
  lockBossProvisionRegistry,
  parseBossProvisionRegistryBackupFile,
  revealBossProvisionSeed,
  updateBossProvisionRegistryEntry,
} from '@/frontend/lib/boss-provision-registry'
import type { useHandoffProvisionRegistryAccess } from '@/frontend/lib/handoff-provision-registry-access'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'
import { assignProvisionHelperMessengerGroup } from '@/frontend/lib/provision-helper-messenger-group'

type RegistryAccess = ReturnType<typeof useHandoffProvisionRegistryAccess>

export function HandoffProvisionRegistrySection(p: {
  registry: RegistryAccess
  onRegistryChanged?: () => void
}) {
  const { registry, onRegistryChanged } = p
  const {
    registryExists,
    registryUnlocked,
    masterPassword,
    setMasterPassword,
    masterPasswordConfirm,
    setMasterPasswordConfirm,
    unlockPassword,
    setUnlockPassword,
    activeMasterPassword,
    setRegistryReady,
    unlockRegistry,
    sessionMasterPassword,
  } = registry

  const [registryFilter, setRegistryFilter] = useState<'all' | 'open'>('all')
  const [registryTick, setRegistryTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [revealEntryId, setRevealEntryId] = useState<string | null>(null)
  const [revealSeed, setRevealSeed] = useState('')
  const [revealBusy, setRevealBusy] = useState(false)
  const backupFileRef = useRef<HTMLInputElement>(null)

  const refreshRegistry = useCallback(() => {
    setRegistryTick((n) => n + 1)
    onRegistryChanged?.()
  }, [onRegistryChanged])

  const entries = registryUnlocked ? getBossProvisionRegistryEntries() : []
  const entryStats = countBossProvisionRegistryByStatus(entries)
  const visibleEntries = entries.filter((e) =>
    registryFilter === 'open' ? !e.handedOverAtIso : true
  )
  const messengerGroups = readMessengerGroups()

  const onUnlockRegistry = async () => {
    setStatusMsg('')
    setBusy(true)
    const r = await unlockRegistry()
    setBusy(false)
    if (!r.ok) {
      setStatusMsg(r.error)
      return
    }
    refreshRegistry()
    setStatusMsg('Registry entsperrt.')
  }

  const onMarkHandedOver = async (id: string) => {
    await updateBossProvisionRegistryEntry(id, { handedOverAtIso: new Date().toISOString() })
    refreshRegistry()
  }

  const onRevealSeed = async (id: string) => {
    if (!registryUnlocked) {
      setStatusMsg('Registry zuerst entsperren.')
      return
    }
    setRevealBusy(true)
    setRevealSeed('')
    setStatusMsg('')
    const entry = getBossProvisionRegistryEntries().find((e) => e.id === id)
    if (!entry) {
      setRevealBusy(false)
      setStatusMsg('Eintrag nicht gefunden.')
      return
    }
    const password = activeMasterPassword()
    if (!password) {
      setRevealBusy(false)
      setStatusMsg('Master-Passwort eingeben und Registry entsperren.')
      return
    }
    const revealed = await revealBossProvisionSeed(entry, password)
    setRevealBusy(false)
    if (!revealed.ok) {
      setStatusMsg(revealed.error)
      return
    }
    setRevealEntryId(id)
    setRevealSeed(revealed.seedImport)
  }

  const onExportRegistryBackup = () => {
    const r = downloadBossProvisionRegistryBackup()
    setStatusMsg(r.ok ? 'Registry-Sicherung heruntergeladen (weiterhin verschlüsselt).' : r.error)
  }

  const onImportRegistryBackup = async (file: File) => {
    setStatusMsg('')
    const text = await file.text()
    const parsed = parseBossProvisionRegistryBackupFile(text)
    if (!parsed.ok) {
      setStatusMsg(parsed.error)
      return
    }
    const password = activeMasterPassword()
    if (!password) {
      setStatusMsg('Zum Importieren Registry zuerst mit Master-Passwort entsperren.')
      return
    }
    if (
      !window.confirm(
        'Lokale Boss-Registry durch diese Sicherung ersetzen? Nur fortfahren, wenn die Datei vertrauenswürdig ist.'
      )
    ) {
      return
    }
    setBusy(true)
    const r = await importBossProvisionRegistryBackup(parsed.payload, password)
    setBusy(false)
    if (!r.ok) {
      setStatusMsg(r.error)
      return
    }
    sessionMasterPassword.current = password
    setRegistryReady(true)
    refreshRegistry()
    setStatusMsg(`Registry importiert (${r.entryCount} Eintrag/Einträge).`)
  }

  return (
    <>
      <section id="einsatz-provision-wizard" className="scroll-mt-4 border-t border-border/60 pt-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Smartphone className="h-4 w-4 text-amber-500" aria-hidden />
          Neues Gerät — Registry
        </p>

        {registryExists && !registryUnlocked ? (
          <div className="mb-3 space-y-2 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4" aria-hidden />
              Boss-Registry entsperren
            </p>
            <Input
              type="password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              placeholder="Master-Passwort"
              autoComplete="current-password"
            />
            <Button type="button" size="sm" disabled={busy} onClick={() => void onUnlockRegistry()}>
              Entsperren
            </Button>
          </div>
        ) : null}

        {!registryExists ? (
          <div className="mb-3 space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Master-Passwort (Custody B)</p>
            <p className="text-xs text-muted-foreground">
              Verschlüsselt die Seed-Historie in diesem Browser. Einmalig vor dem ersten „ZIP + Seed + QR“.
            </p>
            <Input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="Master-Passwort (8+ Zeichen)"
              autoComplete="new-password"
            />
            <Input
              type="password"
              value={masterPasswordConfirm}
              onChange={(e) => setMasterPasswordConfirm(e.target.value)}
              placeholder="Wiederholen"
              autoComplete="new-password"
            />
          </div>
        ) : null}

        {registryUnlocked && entries.length > 0 ? (
          <div className="space-y-2">
            <div
              className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
              key={registryTick}
            >
              <span>
                {entryStats.total} · {entryStats.open} offen · {entryStats.handedOver} übergeben
              </span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={cn(
                    'rounded border px-2 py-0.5',
                    registryFilter === 'all' ? 'border-amber-500/50 bg-amber-500/15' : 'border-border'
                  )}
                  onClick={() => setRegistryFilter('all')}
                >
                  Alle
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded border px-2 py-0.5',
                    registryFilter === 'open' ? 'border-amber-500/50 bg-amber-500/15' : 'border-border'
                  )}
                  onClick={() => setRegistryFilter('open')}
                >
                  Noch nicht übergeben ({entryStats.open})
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full min-w-[32rem] text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Bezeichnung</th>
                    <th className="px-3 py-2 font-medium">Adresse</th>
                    <th className="px-3 py-2 font-medium">Profil</th>
                    <th className="px-3 py-2 font-medium">Gruppe</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.slice(0, 12).map((e) => (
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
                              if (r.ok) refreshRegistry()
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
                            onClick={() => void onRevealSeed(e.id)}
                          >
                            Seed erneut anzeigen
                          </button>
                          {!e.handedOverAtIso ? (
                            <button
                              type="button"
                              className="rounded border border-border px-2 py-0.5 hover:bg-muted"
                              onClick={() => void onMarkHandedOver(e.id)}
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
                onClick={onExportRegistryBackup}
              >
                Sichern
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
                onClick={() => backupFileRef.current?.click()}
              >
                Import
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
                onClick={() => {
                  lockBossProvisionRegistry()
                  sessionMasterPassword.current = ''
                  setRegistryReady(false)
                  refreshRegistry()
                }}
              >
                Registry sperren
              </button>
              <input
                ref={backupFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0]
                  ev.target.value = ''
                  if (f) void onImportRegistryBackup(f)
                }}
              />
            </div>
          </div>
        ) : registryUnlocked ? (
          <p className="text-xs text-muted-foreground">Noch keine Geräte — oben „ZIP + Seed + QR“ ausgeben.</p>
        ) : null}

        {statusMsg ? (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            {statusMsg}
          </p>
        ) : null}
      </section>

      <Dialog open={!!revealEntryId} onOpenChange={(v) => !v && setRevealEntryId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seed (Custody B)</DialogTitle>
            <DialogDescription>Nur Boss — nicht weiterleiten oder screenshotten.</DialogDescription>
          </DialogHeader>
          {revealBusy ? (
            <p className="text-sm text-muted-foreground">Entschlüssele…</p>
          ) : (
            <div className="space-y-3">
              <textarea
                readOnly
                value={revealSeed}
                className="min-h-[5rem] w-full rounded-lg border border-border bg-muted/40 p-2 font-mono text-xs"
              />
              <Button type="button" variant="outline" onClick={() => setRevealEntryId(null)}>
                <EyeOff className="mr-2 h-4 w-4" aria-hidden />
                Schließen
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
