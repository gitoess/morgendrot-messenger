'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QrCode } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import { OnboardingWizardShell } from '@/frontend/components/onboarding/onboarding-wizard-shell'
import { HandoffProvisionResultDialog } from '@/frontend/components/handoff-provision-result-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { buildHandoffZipExportBody } from '@/frontend/lib/handoff-export-build-body'
import {
  fetchHandoffCurrentIdsDefaults,
  mergeHandoffExportDefaults,
  seedHandoffExportDefaultsFromStatus,
  type HandoffExportRuntimeDefaults,
} from '@/frontend/lib/handoff-export-defaults'
import {
  HANDOFF_EINSATZ_PRESETS,
  getHandoffPreset,
  suggestHandoffBezeichnung,
  type HandoffEinsatzPresetId,
} from '@/frontend/lib/handoff-export-presets'
import { HANDOFF_PRESET_VISUAL } from '@/frontend/lib/handoff-preset-ui'
import { provisionNewHandoffDevice } from '@/frontend/lib/handoff-provision-new-device'
import { useHandoffProvisionRegistryAccess } from '@/frontend/lib/handoff-provision-registry-access'

const QUICK_STEPS = 2

export function BossHandoffQuickProvisionWizard(p: {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiSnapshot?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onOpenExpert?: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [presetId, setPresetId] = useState<HandoffEinsatzPresetId>('helfer')
  const [bezeichnung, setBezeichnung] = useState(() => suggestHandoffBezeichnung(getHandoffPreset('helfer')))
  const [defaults, setDefaults] = useState<HandoffExportRuntimeDefaults>(() =>
    seedHandoffExportDefaultsFromStatus(p.apiSnapshot, p.contactDirectory)
  )
  const [busy, setBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [provisionResultOpen, setProvisionResultOpen] = useState(false)
  const [provisionAddress, setProvisionAddress] = useState('')
  const [provisionEntryId, setProvisionEntryId] = useState<string | null>(null)
  const [provisionQrDataUrl, setProvisionQrDataUrl] = useState('')

  const labelEdited = useRef(false)
  const provisionRegistry = useHandoffProvisionRegistryAccess()
  const preset = useMemo(() => getHandoffPreset(presetId), [presetId])
  const bossDefaultTtlDays = p.apiSnapshot?.einsatzConfig?.defaultTtlDays ?? 30

  useEffect(() => {
    if (!p.open) return
    setStepIndex(0)
    setStatusMsg('')
    const seeded = seedHandoffExportDefaultsFromStatus(p.apiSnapshot, p.contactDirectory)
    setDefaults(seeded)
    void fetchHandoffCurrentIdsDefaults().then((patch) => {
      setDefaults((prev) => mergeHandoffExportDefaults(prev, patch))
    })
  }, [p.open, p.apiSnapshot, p.contactDirectory])

  const applyPreset = (id: HandoffEinsatzPresetId) => {
    setPresetId(id)
    if (!labelEdited.current) {
      setBezeichnung(suggestHandoffBezeichnung(getHandoffPreset(id)))
    }
  }

  const ensureRegistry = useCallback(async (): Promise<boolean> => {
    if (provisionRegistry.registryUnlocked) return true
    if (!provisionRegistry.registryExists) {
      const init = await provisionRegistry.initRegistry()
      if (!init.ok) {
        setStatusMsg(init.error)
        return false
      }
      return true
    }
    const unlock = await provisionRegistry.unlockRegistry()
    if (!unlock.ok) {
      setStatusMsg(unlock.error)
      return false
    }
    return true
  }, [provisionRegistry])

  const runProvision = async () => {
    if (!bezeichnung.trim()) {
      setStatusMsg('Bezeichnung fehlt.')
      return
    }
    if (!(await ensureRegistry())) return
    setBusy(true)
    setStatusMsg('')
    try {
      const r = await provisionNewHandoffDevice({
        buildBody: (helperAddress) =>
          buildHandoffZipExportBody({
            activePresetId: presetId,
            bezeichnung,
            selectedTeamIds: defaults.selectedTeamIds,
            handoffBoss: defaults.handoffBoss,
            handoffMailbox: defaults.handoffMailbox,
            handoffRpc: defaults.handoffRpc,
            handoffPkgSource: 'boss',
            handoffPkgCustom: defaults.handoffPkgCustom,
            handoffCmdReg: defaults.handoffCmdReg,
            handoffVaultReg: defaults.handoffVaultReg,
            handoffDirectIota: defaults.handoffDirectIota,
            partnerExportCsv: '',
            includeIotaArchivReadme: true,
            protectWithPassword: false,
            einsatzChainMode: defaults.einsatzChainMode,
            bossDefaultTtlDays,
            exportEnablePurge: p.apiSnapshot?.einsatzConfig?.enablePurge !== false,
            helperAddress,
          }),
        presetId,
        label: bezeichnung.trim() || preset.label,
        masterPassword: provisionRegistry.activeMasterPassword(),
      })
      if (!r.ok) {
        setStatusMsg(r.error)
        return
      }
      setProvisionAddress(r.address)
      setProvisionEntryId(r.entryId)
      setProvisionQrDataUrl(r.qrDataUrl)
      setProvisionResultOpen(true)
      p.onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  const stepTitle = stepIndex === 0 ? 'Wer soll eingerichtet werden?' : 'ZIP + Seed-QR erstellen'

  return (
    <>
      <OnboardingWizardShell
        open={p.open}
        onOpenChange={p.onOpenChange}
        title="Schnell-Assistent — Handoff"
        description="Standardweg mit Preset-Defaults. Rechte-Matrix, Partner und IOTA-Versand: Experten-Assistent."
        stepIndex={stepIndex}
        stepTotal={QUICK_STEPS}
        stepTitle={stepTitle}
        showBack={stepIndex > 0}
        onBack={() => setStepIndex(0)}
        onNext={
          stepIndex === 0
            ? () => setStepIndex(1)
            : () => void runProvision()
        }
        nextLabel={stepIndex === 0 ? 'Weiter' : busy ? '…' : 'ZIP + Seed + QR'}
        nextDisabled={
          stepIndex === 0 ? !bezeichnung.trim() : busy || !provisionRegistry.registryUnlocked
        }
      >
        {stepIndex === 0 ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="quick-handoff-label" className="mb-1 block text-xs font-medium text-muted-foreground">
                Bezeichnung / Callsign
              </label>
              <input
                id="quick-handoff-label"
                value={bezeichnung}
                onChange={(e) => {
                  labelEdited.current = true
                  setBezeichnung(e.target.value)
                }}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
                placeholder="z. B. Medic Nord"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {HANDOFF_EINSATZ_PRESETS.map((item) => {
                const vis = HANDOFF_PRESET_VISUAL[item.id]
                const active = presetId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyPreset(item.id)}
                    className={cn(
                      'rounded-lg border p-2.5 text-left text-sm transition-colors',
                      active ? cn('ring-2', vis.activeRing, vis.activeBg) : cn('bg-muted/15', vis.idleBorder)
                    )}
                  >
                    <span className="font-semibold">
                      {vis.emoji} {item.label}
                    </span>
                    <span className="mt-1 block text-[10px] leading-snug text-muted-foreground">{item.hint}</span>
                  </button>
                )
              })}
            </div>
            {presetId === 'fuehrer' ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Führer = Kommandant (höchste Handoff-Stufe) — kein zweiter Boss/Einsatzleitung.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              <strong className="text-foreground">{bezeichnung.trim() || preset.label}</strong> · Preset{' '}
              <strong className="text-foreground">{preset.label}</strong>
            </p>
            <p className="text-muted-foreground">
              Es wird ein neues Wallet erzeugt, Handoff-ZIP heruntergeladen und ein Seed-QR für 60 Sekunden angezeigt.
              Der Roster-Vorschlag erscheint oben im Panel „Beitrittsanfragen &amp; Roster-Vorschläge“.
            </p>
            {!provisionRegistry.registryUnlocked ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Provision-Registry ist gesperrt — bitte zuerst im{' '}
                {p.onOpenExpert ? (
                  <button type="button" className="underline" onClick={p.onOpenExpert}>
                    Experten-Assistent
                  </button>
                ) : (
                  'Experten-Assistent'
                )}{' '}
                entsperren oder anlegen.
              </p>
            ) : null}
            {statusMsg ? (
              <p className="text-xs text-destructive" role="alert">
                {statusMsg}
              </p>
            ) : null}
            {p.onOpenExpert ? (
              <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs" onClick={p.onOpenExpert}>
                Spezielle Rechte, Partner oder IOTA → Experten-Assistent öffnen
              </Button>
            ) : null}
          </div>
        )}
      </OnboardingWizardShell>

      <HandoffProvisionResultDialog
        open={provisionResultOpen}
        onOpenChange={setProvisionResultOpen}
        address={provisionAddress}
        entryId={provisionEntryId}
        qrDataUrl={provisionQrDataUrl}
      />
    </>
  )
}
