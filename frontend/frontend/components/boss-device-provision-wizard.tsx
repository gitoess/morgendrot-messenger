'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Download, EyeOff, KeyRound, QrCode, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import type { MessengerCapabilitiesOverride } from '@morgendrot/shared/messenger-capabilities-matrix'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { fetchGenerateMnemonic } from '@/frontend/lib/api/generate-mnemonic'
import { fetchEinsatzRoleTemplates } from '@/frontend/lib/api/einsatz-role-templates'
import type { EinsatzRoleTemplate } from '@morgendrot/shared/einsatz-role-templates'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { fetchHandoffCurrentIdsFields } from '@/frontend/lib/handoff-export-defaults'
import { downloadHandoffZipExport } from '@/frontend/lib/handoff-export-download'
import { validateHandoffExportPassword } from '@/frontend/lib/handoff-zip-crypto'
import { buildWizardHandoffExportBody } from '@/frontend/lib/handoff-export-defaults'
import {
  resolveHandoffExportParams,
  type HandoffExportTuning,
} from '@/frontend/lib/handoff-export-params'
import { applyEinsatzHandoffTemplate } from '@/frontend/lib/handoff-export-to-template'
import {
  applyHandoffCapabilityPresetToTuning,
  getWizardCapabilityPresets,
  type HandoffCapabilityPreset,
} from '@/frontend/lib/handoff-capability-presets'
import {
  getHandoffPreset,
  HANDOFF_EINSATZ_PRESETS,
  suggestHandoffBezeichnung,
  type HandoffEinsatzPresetId,
} from '@/frontend/lib/handoff-export-presets'
import { HANDOFF_PRESET_VISUAL } from '@/frontend/lib/handoff-preset-ui'
import { formatHandoffAddressShort } from '@/frontend/lib/handoff-export-display'
import {
  addBossProvisionRegistryEntry,
  countBossProvisionRegistryByStatus,
  downloadBossProvisionRegistryBackup,
  getBossProvisionRegistryEntries,
  hasBossProvisionRegistry,
  importBossProvisionRegistryBackup,
  initializeBossProvisionRegistry,
  isBossProvisionRegistryUnlocked,
  lockBossProvisionRegistry,
  parseBossProvisionRegistryBackupFile,
  revealBossProvisionSeed,
  unlockBossProvisionRegistry,
  updateBossProvisionRegistryEntry,
} from '@/frontend/lib/boss-provision-registry'
import { buildSeedSetupQrText } from '@/frontend/lib/seed-setup-qr'
import { writeHandoffLastPresetId } from '@/frontend/lib/handoff-last-preset'

const SEED_QR_SECONDS = 60

type BossDeviceProvisionWizardProps = {
  apiSnapshot?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  /** Unter „Helfer einrichten“ — Seed/QR-Block, Rechte im Formular darüber */
  companionSeedBlock?: boolean
}

export function BossDeviceProvisionWizard(p: BossDeviceProvisionWizardProps) {
  const defaultPreset = getHandoffPreset('helfer')
  const [open, setOpen] = useState(false)
  const [presetId, setPresetId] = useState<HandoffEinsatzPresetId>('helfer')
  const [bezeichnung, setBezeichnung] = useState(() => suggestHandoffBezeichnung(defaultPreset))
  const [exportTuning, setExportTuning] = useState<HandoffExportTuning>({})
  const [capabilitiesOverride, setCapabilitiesOverride] = useState<MessengerCapabilitiesOverride | null>(null)
  const [capabilityPresetId, setCapabilityPresetId] = useState<string | null>(null)
  const [savedTemplates, setSavedTemplates] = useState<EinsatzRoleTemplate[]>([])
  const [chainIds, setChainIds] = useState<{
    rpcUrl?: string
    mailboxId?: string
    commandRegistryId?: string
    vaultRegistryId?: string
  }>({})
  const [masterPassword, setMasterPassword] = useState('')
  const [masterPasswordConfirm, setMasterPasswordConfirm] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [registryReady, setRegistryReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [resultOpen, setResultOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0)
  const [generatedAddress, setGeneratedAddress] = useState('')
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null)
  const [seedAcknowledged, setSeedAcknowledged] = useState(false)
  const [revealEntryId, setRevealEntryId] = useState<string | null>(null)
  const [revealSeed, setRevealSeed] = useState('')
  const [revealBusy, setRevealBusy] = useState(false)
  const [protectHandoffZip, setProtectHandoffZip] = useState(false)
  const [handoffZipPassword, setHandoffZipPassword] = useState('')
  const [handoffZipPasswordConfirm, setHandoffZipPasswordConfirm] = useState('')
  const [registryFilter, setRegistryFilter] = useState<'all' | 'open'>('all')
  const [registryTick, setRegistryTick] = useState(0)
  const backupFileRef = useRef<HTMLInputElement>(null)
  const labelEdited = useRef(false)
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionMasterPassword = useRef('')

  const registryExists = hasBossProvisionRegistry()
  const registryUnlocked = isBossProvisionRegistryUnlocked()
  const entries = registryUnlocked ? getBossProvisionRegistryEntries() : []
  const entryStats = countBossProvisionRegistryByStatus(entries)
  const visibleEntries = entries.filter((e) =>
    registryFilter === 'open' ? !e.handedOverAtIso : true
  )

  const refreshRegistryState = useCallback(() => {
    setRegistryReady(isBossProvisionRegistryUnlocked())
    setRegistryTick((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const r = await fetchEinsatzRoleTemplates()
      if (!cancelled && r.ok) setSavedTemplates(r.templates ?? [])
    })()
    void fetchHandoffCurrentIdsFields().then((j) => {
      if (cancelled) return
      setChainIds({
        rpcUrl: j.rpcUrl?.trim() || undefined,
        mailboxId: j.mailboxId?.trim() || undefined,
        commandRegistryId: j.commandRegistryId?.trim() || undefined,
        vaultRegistryId: j.vaultRegistryId?.trim() || undefined,
      })
    })
    if (registryExists && registryUnlocked) {
      setRegistryReady(true)
    } else if (!registryExists) {
      setRegistryReady(false)
    }
    return () => {
      cancelled = true
    }
  }, [open, registryExists, registryUnlocked])

  useEffect(() => {
    return () => {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current)
    }
  }, [])

  const clearQrTimer = () => {
    if (qrTimerRef.current) {
      clearInterval(qrTimerRef.current)
      qrTimerRef.current = null
    }
    setQrSecondsLeft(0)
    setQrDataUrl('')
  }

  const applyTemplate = (t: EinsatzRoleTemplate) => {
    const applied = applyEinsatzHandoffTemplate(t)
    setPresetId(applied.presetId)
    setExportTuning(applied.tuning)
    setCapabilitiesOverride(applied.capabilitiesOverride)
    setCapabilityPresetId(null)
    if (!labelEdited.current) {
      setBezeichnung(applied.bezeichnungSuggestion)
    }
    setStatusMsg(
      applied.hasFullSnapshot
        ? `Vorlage „${t.label}" geladen (Capabilities inkl.).`
        : `Vorlage „${t.label}" geladen.`
    )
  }

  const applyCapabilityPreset = useCallback(
    (capPreset: HandoffCapabilityPreset) => {
      const merged = applyHandoffCapabilityPresetToTuning(presetId, exportTuning, capPreset.apply)
      setExportTuning(merged.tuning)
      setCapabilitiesOverride(merged.override)
      setCapabilityPresetId(capPreset.id)
      setStatusMsg(`Sonderrolle „${capPreset.label}" — ${capPreset.hint}`)
    },
    [presetId, exportTuning]
  )

  const clearCapabilityPreset = useCallback(() => {
    setCapabilitiesOverride(null)
    setCapabilityPresetId(null)
    setExportTuning((prev: HandoffExportTuning) => {
      const next = { ...prev }
      delete next.roleId
      return next
    })
  }, [])

  const rememberMasterPassword = (password: string) => {
    sessionMasterPassword.current = password
  }

  const activeMasterPassword = (): string =>
    sessionMasterPassword.current || unlockPassword.trim() || masterPassword.trim()

  const ensureRegistryAccess = async (): Promise<boolean> => {
    if (registryUnlocked) return true
    if (!registryExists) {
      if (masterPassword.length < 8) {
        setStatusMsg('Master-Passwort für die Boss-Registry: mindestens 8 Zeichen.')
        return false
      }
      if (masterPassword !== masterPasswordConfirm) {
        setStatusMsg('Master-Passwort und Wiederholung stimmen nicht überein.')
        return false
      }
      const init = await initializeBossProvisionRegistry(masterPassword, masterPasswordConfirm)
      if (!init.ok) {
        setStatusMsg(init.error)
        return false
      }
      rememberMasterPassword(masterPassword)
      setRegistryReady(true)
      return true
    }
    if (!unlockPassword.trim()) {
      setStatusMsg('Registry ist gesperrt — Master-Passwort zum Entsperren eingeben.')
      return false
    }
    const unlock = await unlockBossProvisionRegistry(unlockPassword)
    if (!unlock.ok) {
      setStatusMsg(unlock.error)
      return false
    }
    rememberMasterPassword(unlockPassword)
    setRegistryReady(true)
    setUnlockPassword('')
    return true
  }

  const onUnlockRegistry = async () => {
    setStatusMsg('')
    if (!unlockPassword.trim()) {
      setStatusMsg('Master-Passwort eingeben.')
      return
    }
    setBusy(true)
    const unlock = await unlockBossProvisionRegistry(unlockPassword)
    setBusy(false)
    if (!unlock.ok) {
      setStatusMsg(unlock.error)
      return
    }
    rememberMasterPassword(unlockPassword)
    setRegistryReady(true)
    setUnlockPassword('')
    setStatusMsg('Registry entsperrt.')
  }

  const onGenerateAndExport = async () => {
    setStatusMsg('')
    setBusy(true)
    try {
      const access = await ensureRegistryAccess()
      if (!access) return

      const mnemonic = await fetchGenerateMnemonic()
      if (!mnemonic.ok) {
        setStatusMsg(mnemonic.error)
        return
      }

      const body = buildWizardHandoffExportBody({
        apiSnapshot: p.apiSnapshot,
        contactDirectory: p.contactDirectory,
        presetId,
        bezeichnung,
        tuning: exportTuning,
        ids: chainIds,
        helperAddress: mnemonic.address,
        capabilitiesOverride,
      })

      if (protectHandoffZip) {
        const pwErr = validateHandoffExportPassword(handoffZipPassword, handoffZipPasswordConfirm)
        if (pwErr) {
          setStatusMsg(pwErr)
          return
        }
      }

      const zip = await downloadHandoffZipExport(
        body,
        protectHandoffZip ? { password: handoffZipPassword } : {}
      )
      if (!zip.ok) {
        setStatusMsg(zip.error)
        return
      }
      writeHandoffLastPresetId(presetId)

      const added = await addBossProvisionRegistryEntry({
        label: bezeichnung.trim() || getHandoffPreset(presetId).label,
        presetId,
        address: mnemonic.address,
        seedImport: mnemonic.secretKey,
        zipFilenameBase: bezeichnung.trim().replace(/\s+/g, '-').slice(0, 40) || 'handoff',
        masterPassword: activeMasterPassword(),
      })
      if (!added.ok) {
        setStatusMsg(added.error)
        return
      }

      setCurrentEntryId(added.entry.id)
      setGeneratedAddress(mnemonic.address)
      setSeedAcknowledged(false)

      const qrText = buildSeedSetupQrText({ seedImport: mnemonic.secretKey, address: mnemonic.address })
      const url = await QRCode.toDataURL(qrText, { width: 240, margin: 2 })
      setQrDataUrl(url)
      setQrSecondsLeft(SEED_QR_SECONDS)
      if (qrTimerRef.current) clearInterval(qrTimerRef.current)
      qrTimerRef.current = setInterval(() => {
        setQrSecondsLeft((prev) => {
          if (prev <= 1) {
            clearQrTimer()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      setResultOpen(true)
      refreshRegistryState()
      setStatusMsg(
        protectHandoffZip
          ? 'Passwortgeschütztes ZIP — Handoff-Passwort dem Helfer mündlich mitteilen (nicht in der ZIP). Seed-QR: 60 Sekunden.'
          : 'ZIP heruntergeladen — Seed-QR dem Helfer zeigen (60 Sekunden).'
      )
    } finally {
      setBusy(false)
    }
  }

  const onConfirmSeedShown = async () => {
    if (!currentEntryId) return
    setSeedAcknowledged(true)
    await updateBossProvisionRegistryEntry(currentEntryId, {
      seedShownAtIso: new Date().toISOString(),
    })
    refreshRegistryState()
  }

  const onMarkHandedOver = async (id: string) => {
    await updateBossProvisionRegistryEntry(id, { handedOverAtIso: new Date().toISOString() })
    refreshRegistryState()
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
      setStatusMsg('Zum Importieren Registry zuerst mit Master-Passwort entsperren (Passwort muss zur Sicherung passen).')
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
    rememberMasterPassword(password)
    setRegistryReady(true)
    refreshRegistryState()
    setStatusMsg(`Registry importiert (${r.entryCount} Eintrag/Einträge).`)
  }

  const preset = useMemo(() => getHandoffPreset(presetId), [presetId])
  const resolvedParams = useMemo(
    () => resolveHandoffExportParams(presetId, exportTuning),
    [presetId, exportTuning]
  )
  const wizardCapabilityPresets = useMemo(() => getWizardCapabilityPresets(), [])

  return (
    <>
      <section
        id="einsatz-provision-wizard"
        className={cn(
          'scroll-mt-4',
          p.companionSeedBlock
            ? 'border-t border-border/60 pt-4'
            : 'rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 to-card p-4'
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Smartphone className="h-4 w-4 text-amber-500" aria-hidden />
            {p.companionSeedBlock ? 'Neues Gerät' : 'Neues Gerät provisionieren'}
          </p>
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            {p.companionSeedBlock ? 'Seed + QR' : 'Wizard öffnen'}
          </Button>
        </div>

        {registryUnlocked && entries.length > 0 ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" key={registryTick}>
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
                          Seed
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
        ) : null}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerät provisionieren</DialogTitle>
            <DialogDescription>
              Bezeichnung und Profil wählen — System erzeugt Seed, Handoff-ZIP und QR für den Helfer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-muted-foreground">
              <strong className="text-foreground">Sicherheit:</strong> Registry liegt in{' '}
              <span className="font-mono">localStorage</span> dieses Browsers. Behandeln Sie den Boss-PC als{' '}
              <strong className="text-foreground">High-Security-Gerät</strong> (Vollverschlüsselung, kein
              Fremdzugriff). Ist die Registry <strong className="text-foreground">entsperrt</strong>, liegen
              entschlüsselte Seeds im RAM — bei Kompromittierung des Laptops sind alle Einträge gefährdet. Nach
              Einsatz: <strong className="text-foreground">Registry sperren</strong> oder Browser schließen.
            </div>

            {registryReady ? (
              <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs">
                <strong className="text-foreground">Registry entsperrt (Browser-Sitzung).</strong> Master-Passwort
                muss nicht bei jedem Gerät erneut eingegeben werden — nur bis Sie „Registry sperren“ klicken oder den
                Tab schließen. Seeds dann nur noch mit erneutem Entsperren sichtbar.
              </div>
            ) : null}

            {registryExists && !registryReady ? (
              <div className="space-y-2 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
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
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Master-Passwort (neu — Custody B)</p>
                <p className="text-xs text-muted-foreground">
                  Verschlüsselt die Seed-Historie in diesem Browser (AES-GCM). Ohne Passwort keine Wiederanzeige.
                  Pro Browser-Profil — nicht geräteübergreifend. Backup: „Registry sichern“ nach dem ersten Gerät.
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

            <div>
              <Label htmlFor="prov-bezeichnung">Bezeichnung</Label>
              <Input
                id="prov-bezeichnung"
                value={bezeichnung}
                onChange={(e) => {
                  labelEdited.current = true
                  setBezeichnung(e.target.value)
                }}
                placeholder="z. B. Anna – Helfer Zug Süd"
                className="mt-1"
              />
            </div>

            {savedTemplates.length > 0 ? (
              <label className="block text-sm">
                <span className="text-muted-foreground">Optional: Vorlage laden</span>
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-input px-2 py-2 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value
                    e.target.value = ''
                    const t = savedTemplates.find((x) => x.id === id)
                    if (t) applyTemplate(t)
                  }}
                >
                  <option value="">— keine —</option>
                  {savedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profil</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {HANDOFF_EINSATZ_PRESETS.map((item) => {
                  const vis = HANDOFF_PRESET_VISUAL[item.id]
                  const active = presetId === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setPresetId(item.id)
                        setExportTuning({})
                        setCapabilitiesOverride(null)
                        setCapabilityPresetId(null)
                        if (!labelEdited.current) setBezeichnung(suggestHandoffBezeichnung(item))
                      }}
                      className={cn(
                        'rounded-xl border p-3 text-left text-sm transition-all',
                        active ? cn('ring-2', vis.activeRing, vis.activeBg) : cn('bg-muted/15', vis.idleBorder)
                      )}
                    >
                      <span className="font-semibold">{item.label}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">{item.hint}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sonderrolle (optional)
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {wizardCapabilityPresets.map((cap) => {
                  const active = capabilityPresetId === cap.id
                  return (
                    <button
                      key={cap.id}
                      type="button"
                      onClick={() => applyCapabilityPreset(cap)}
                      className={cn(
                        'rounded-xl border p-3 text-left text-sm transition-all',
                        active
                          ? 'border-violet-500/50 bg-violet-500/15 ring-2 ring-violet-500/40'
                          : 'border-border bg-muted/15 hover:bg-muted/25'
                      )}
                    >
                      <span className="font-semibold">{cap.label}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">{cap.hint}</span>
                    </button>
                  )
                })}
              </div>
              {capabilityPresetId ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-primary underline hover:no-underline"
                  onClick={clearCapabilityPreset}
                >
                  Sonderrolle zurücksetzen
                </button>
              ) : (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Weitere Rechte (Partner, alle Kanäle, Passwort-ZIP):{' '}
                  <Link href="#einsatz-erweitert" className="text-primary underline hover:no-underline">
                    Erweitert → Export-Assistent
                  </Link>
                </p>
              )}
            </div>

            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
              <strong className="text-foreground">{preset.label}</strong>
              {capabilityPresetId ? (
                <span className="text-muted-foreground">
                  {' '}
                  · {wizardCapabilityPresets.find((c) => c.id === capabilityPresetId)?.label}
                </span>
              ) : null}
              <span className="text-muted-foreground"> · ROLE_ID={resolvedParams.roleId}</span>
              {capabilitiesOverride ? (
                <span className="text-muted-foreground"> · Capabilities angepasst</span>
              ) : null}
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={protectHandoffZip}
                  onChange={(e) => setProtectHandoffZip(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <strong className="text-foreground">Handoff-ZIP mit Passwort</strong>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Standard: Klartext-ZIP (schnelle Übergabe). Optional wie Export-Assistent — Passwort mündlich
                    zum Helfer.
                  </span>
                </span>
              </label>
              {protectHandoffZip ? (
                <div className="space-y-2 pl-6">
                  <Input
                    type="password"
                    value={handoffZipPassword}
                    onChange={(e) => setHandoffZipPassword(e.target.value)}
                    placeholder="Handoff-Passwort (8+ Zeichen)"
                    autoComplete="new-password"
                  />
                  <Input
                    type="password"
                    value={handoffZipPasswordConfirm}
                    onChange={(e) => setHandoffZipPasswordConfirm(e.target.value)}
                    placeholder="Handoff-Passwort wiederholen"
                    autoComplete="new-password"
                  />
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={busy}
              onClick={() => void onGenerateAndExport()}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              {busy ? 'Generiere…' : 'Generieren & Exportieren'}
            </Button>

            {statusMsg ? (
              <p className="text-xs text-muted-foreground" role="status">
                {statusMsg}
              </p>
            ) : null}

            {registryReady ? (
              <button
                type="button"
                className="text-xs text-muted-foreground underline hover:text-foreground"
                onClick={() => {
                  lockBossProvisionRegistry()
                  sessionMasterPassword.current = ''
                  setRegistryReady(false)
                  refreshRegistryState()
                }}
              >
                Registry sperren
              </button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resultOpen}
        onOpenChange={(v) => {
          if (!v) clearQrTimer()
          setResultOpen(v)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seed & ZIP bereit</DialogTitle>
            <DialogDescription>
              ZIP wurde heruntergeladen{protectHandoffZip ? ' (passwortgeschützt)' : ''}. Seed nur über QR oder
              Registry — nie in der ZIP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="font-mono text-xs text-foreground">{formatHandoffAddressShort(generatedAddress)}</p>

            {qrDataUrl && qrSecondsLeft > 0 ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-center">
                <p className="mb-2 flex items-center justify-center gap-2 text-sm font-medium">
                  <QrCode className="h-4 w-4" aria-hidden />
                  Seed-QR ({qrSecondsLeft}s)
                </p>
                <img src={qrDataUrl} alt="Seed-QR für Helfer" className="mx-auto rounded-lg border border-border" />
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Helfer: nach ZIP-Import „Seed einrichten?“ → QR scannen.
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                QR abgelaufen. Seed über Boss-Registry (Master-Passwort) erneut anzeigen.
              </p>
            )}

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={seedAcknowledged}
                onChange={(e) => {
                  if (e.target.checked) void onConfirmSeedShown()
                  else setSeedAcknowledged(false)
                }}
                className="mt-1"
              />
              <span>Seed dem Helfer gezeigt / sicher übergeben</span>
            </label>

            <Button type="button" variant="outline" className="w-full" onClick={() => setResultOpen(false)}>
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
