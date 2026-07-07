'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApiStatus } from '@/frontend/lib/api'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import type { MessengerCapabilitiesOverride } from '@morgendrot/shared/messenger-capabilities-matrix'
import { OnboardingWizardShell } from '@/frontend/components/onboarding/onboarding-wizard-shell'
import { HandoffProvisionResultDialog } from '@/frontend/components/handoff-provision-result-dialog'
import { HandoffProvisionRegistryMini } from '@/frontend/components/handoff-provision-registry-mini'
import { HandoffQuickWizardRightsStep } from '@/frontend/components/handoff-quick-wizard-rights-step'
import { HandoffQuickWizardTeamStep } from '@/frontend/components/handoff-quick-wizard-team-step'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Download, QrCode } from 'lucide-react'
import { buildHandoffZipExportBody } from '@/frontend/lib/handoff-export-build-body'
import { downloadHandoffZipExport } from '@/frontend/lib/handoff-export-download'
import {
  buildTeamMailboxOptions,
  pickPrimaryMailboxId,
} from '@/frontend/lib/handoff-export-autofill'
import {
  fetchHandoffCurrentIdsDefaults,
  mergeHandoffExportDefaults,
  seedHandoffExportDefaultsFromStatus,
  type HandoffExportRuntimeDefaults,
} from '@/frontend/lib/handoff-export-defaults'
import type { HandoffExportTuning } from '@/frontend/lib/handoff-export-params'
import {
  HANDOFF_CAPABILITY_PRESETS,
  applyHandoffCapabilityPresetToTuning,
} from '@/frontend/lib/handoff-capability-presets'
import {
  HANDOFF_EINSATZ_PRESETS,
  getHandoffPreset,
  suggestHandoffBezeichnung,
  type HandoffEinsatzPresetId,
} from '@/frontend/lib/handoff-export-presets'
import { HANDOFF_PRESET_VISUAL } from '@/frontend/lib/handoff-preset-ui'
import { provisionNewHandoffDevice } from '@/frontend/lib/handoff-provision-new-device'
import { writeHandoffLastPresetId } from '@/frontend/lib/handoff-last-preset'
import { readActiveGroupId } from '@/frontend/lib/messenger-group-store'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'
import { HandoffProvisionGroupSelect } from '@/frontend/components/handoff-provision-group-select'
import { useHandoffProvisionRegistryAccess } from '@/frontend/lib/handoff-provision-registry-access'

type QuickDeliverMode = 'team-wallet' | 'own-wallet'

const STEP_WHO = 0
const STEP_RIGHTS = 1
const STEP_TEAM = 2
const STEP_REGISTRY = 3
const STEP_DELIVER = 4
const QUICK_STEPS = 5

const STEP_TITLES = [
  'Wer soll eingerichtet werden?',
  'Rechte (optional)',
  'Team-Postfächer (optional)',
  'Provision-Registry (optional)',
  'Handoff ausliefern',
] as const

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
  const [exportTuning, setExportTuning] = useState<HandoffExportTuning>({})
  const [capabilitiesOverride, setCapabilitiesOverride] = useState<MessengerCapabilitiesOverride | null>(null)
  const [selectedCapPresetId, setSelectedCapPresetId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [provisionResultOpen, setProvisionResultOpen] = useState(false)
  const [provisionAddress, setProvisionAddress] = useState('')
  const [provisionEntryId, setProvisionEntryId] = useState<string | null>(null)
  const [provisionQrDataUrl, setProvisionQrDataUrl] = useState('')
  const [deliverMode, setDeliverMode] = useState<QuickDeliverMode>('team-wallet')
  const [zipOnlyDone, setZipOnlyDone] = useState(false)
  const [selectedMessengerGroupId, setSelectedMessengerGroupId] = useState<string | null>(null)

  const labelEdited = useRef(false)
  const wasOpenRef = useRef(false)
  const provisionRegistry = useHandoffProvisionRegistryAccess()
  const preset = useMemo(() => getHandoffPreset(presetId), [presetId])
  const bossDefaultTtlDays = p.apiSnapshot?.einsatzConfig?.defaultTtlDays ?? 30
  const teamMailboxOptions = useMemo(
    () => buildTeamMailboxOptions(p.apiSnapshot ?? null, readMyTeamMailboxes()),
    [p.apiSnapshot]
  )
  const defaultTeamMailboxId = useMemo(
    () => pickPrimaryMailboxId(defaults.selectedTeamIds) || defaults.handoffMailbox.trim() || undefined,
    [defaults.selectedTeamIds, defaults.handoffMailbox]
  )

  /** Nur beim Öffnen zurücksetzen — nicht bei jedem Status-Poll (apiSnapshot-Referenz). */
  useEffect(() => {
    const wasOpen = wasOpenRef.current
    wasOpenRef.current = p.open
    if (!p.open) return
    if (wasOpen) return

    setStepIndex(0)
    setStatusMsg('')
    setExportTuning({})
    setCapabilitiesOverride(null)
    setSelectedCapPresetId(null)
    setDeliverMode('team-wallet')
    setZipOnlyDone(false)
    setSelectedMessengerGroupId(readActiveGroupId())
    labelEdited.current = false
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

  const applyCapPreset = useCallback(
    (id: string | null) => {
      setSelectedCapPresetId(id)
      if (!id) {
        setExportTuning({})
        setCapabilitiesOverride(null)
        return
      }
      const cap = HANDOFF_CAPABILITY_PRESETS.find((item) => item.id === id)
      if (!cap) return
      const merged = applyHandoffCapabilityPresetToTuning(presetId, {}, cap.apply)
      setExportTuning(merged.tuning)
      setCapabilitiesOverride(merged.override)
    },
    [presetId]
  )

  const toggleTeamId = (id: string) => {
    setDefaults((prev) => {
      const ids = prev.selectedTeamIds
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
      return { ...prev, selectedTeamIds: next }
    })
  }

  const buildQuickExportBody = useCallback(
    (helperAddress?: string) =>
      buildHandoffZipExportBody({
        activePresetId: presetId,
        bezeichnung,
        exportTuning,
        capabilitiesOverride,
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
        messengerGroupId: selectedMessengerGroupId ?? undefined,
      }),
    [
      presetId,
      bezeichnung,
      exportTuning,
      capabilitiesOverride,
      defaults,
      bossDefaultTtlDays,
      p.apiSnapshot?.einsatzConfig?.enablePurge,
      selectedMessengerGroupId,
    ]
  )

  const runProvision = async () => {
    if (!bezeichnung.trim()) {
      setStatusMsg('Bezeichnung fehlt.')
      return
    }
    if (!provisionRegistry.registryUnlocked) {
      setStatusMsg('Registry ist noch gesperrt.')
      return
    }
    setBusy(true)
    setStatusMsg('')
    try {
      const r = await provisionNewHandoffDevice({
        buildBody: (helperAddress) => buildQuickExportBody(helperAddress),
        presetId,
        label: bezeichnung.trim() || preset.label,
        masterPassword: provisionRegistry.activeMasterPassword(),
        messengerGroupId: selectedMessengerGroupId ?? undefined,
      })
      if (!r.ok) {
        setStatusMsg(r.error)
        return
      }
      setProvisionAddress(r.address)
      setProvisionEntryId(r.entryId)
      setProvisionQrDataUrl(r.qrDataUrl)
      setProvisionResultOpen(true)
      // Wizard schließen — Ergebnis-Dialog bleibt offen (Geschwister-Dialog)
      p.onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  const runZipOnly = async () => {
    if (!bezeichnung.trim()) {
      setStatusMsg('Bezeichnung fehlt.')
      return
    }
    setBusy(true)
    setStatusMsg('')
    setZipOnlyDone(false)
    try {
      const r = await downloadHandoffZipExport(buildQuickExportBody(), {})
      if (!r.ok) {
        setStatusMsg(r.error)
        return
      }
      writeHandoffLastPresetId(presetId)
      setZipOnlyDone(true)
      setStatusMsg('')
    } finally {
      setBusy(false)
    }
  }

  const runDeliver = async () => {
    if (deliverMode === 'own-wallet') {
      await runZipOnly()
      return
    }
    await runProvision()
  }

  const isSkipStep =
    stepIndex === STEP_RIGHTS || stepIndex === STEP_TEAM || stepIndex === STEP_REGISTRY
  const isLastStep = stepIndex === STEP_DELIVER

  const nextDisabled =
    (stepIndex === STEP_WHO && !bezeichnung.trim()) ||
    (isLastStep && busy) ||
    (isLastStep && deliverMode === 'team-wallet' && !provisionRegistry.registryUnlocked)

  const nextLabel = isLastStep
    ? busy
      ? '…'
      : deliverMode === 'own-wallet'
        ? 'Nur ZIP herunterladen'
        : 'ZIP + Seed + QR'
    : 'Weiter'

  return (
    <>
      <OnboardingWizardShell
        open={p.open}
        onOpenChange={p.onOpenChange}
        title="Schnell-Assistent — Handoff"
        description="Standardweg mit Preset-Defaults. Volle Matrix, Partner und IOTA: Experten-Assistent."
        stepIndex={stepIndex}
        stepTotal={QUICK_STEPS}
        stepTitle={STEP_TITLES[stepIndex]}
        showBack={stepIndex > 0}
        onBack={() => setStepIndex((i) => Math.max(0, i - 1))}
        showSkip={isSkipStep}
        onSkip={isSkipStep ? () => setStepIndex((i) => i + 1) : undefined}
        onNext={
          isLastStep
            ? () => void runDeliver()
            : () => setStepIndex((i) => Math.min(QUICK_STEPS - 1, i + 1))
        }
        nextLabel={nextLabel}
        nextDisabled={nextDisabled}
      >
        {stepIndex === STEP_WHO ? (
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
        ) : null}

        {stepIndex === STEP_RIGHTS ? (
          <HandoffQuickWizardRightsStep
            selectedPresetId={selectedCapPresetId}
            capabilitiesOverride={capabilitiesOverride}
            onSelectPreset={applyCapPreset}
            onOpenExpert={p.onOpenExpert}
          />
        ) : null}

        {stepIndex === STEP_TEAM ? (
          <HandoffQuickWizardTeamStep
            apiSnapshot={p.apiSnapshot}
            presetId={presetId}
            selectedTeamIds={defaults.selectedTeamIds}
            onToggleTeamId={toggleTeamId}
            onOpenExpert={p.onOpenExpert}
          />
        ) : null}

        {stepIndex === STEP_REGISTRY ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Nur für <strong className="font-medium text-foreground">ZIP + Seed + QR</strong> (Team-Wallet):
              verschlüsselte Seed-Historie in diesem Browser. Bei <strong className="font-medium text-foreground">Nur
              ZIP</strong> überspringen.
            </p>
            <HandoffProvisionRegistryMini registry={provisionRegistry} />
          </div>
        ) : null}

        {stepIndex === STEP_DELIVER ? (
          <div className="space-y-4 text-sm">
            <p>
              <strong className="text-foreground">{bezeichnung.trim() || preset.label}</strong> · Preset{' '}
              <strong className="text-foreground">{preset.label}</strong>
              {selectedCapPresetId ? (
                <>
                  {' '}
                  · Profil <strong className="text-foreground">{selectedCapPresetId}</strong>
                </>
              ) : null}
            </p>

            <div className="grid gap-2">
              <button
                type="button"
                aria-pressed={deliverMode === 'team-wallet'}
                onClick={() => setDeliverMode('team-wallet')}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  deliverMode === 'team-wallet'
                    ? 'border-emerald-500/50 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                    : 'border-border bg-muted/15 hover:bg-muted/30'
                )}
              >
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <QrCode className="h-4 w-4 shrink-0" aria-hidden />
                  ZIP + Seed + QR (Team-Wallet)
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Boss erzeugt neues Helfer-Wallet, speichert Seed in Registry, QR ~60 s. Für Einsatz / Gerät der
                  Einheit.
                </p>
              </button>
              <button
                type="button"
                aria-pressed={deliverMode === 'own-wallet'}
                onClick={() => setDeliverMode('own-wallet')}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  deliverMode === 'own-wallet'
                    ? 'border-sky-500/50 bg-sky-500/10 ring-2 ring-sky-500/30'
                    : 'border-border bg-muted/15 hover:bg-muted/30'
                )}
              >
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <Download className="h-4 w-4 shrink-0" aria-hidden />
                  Nur ZIP (eigene Wallet)
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nur Konfiguration — kein Seed, keine Registry. Helfer legt Wallet selbst an oder nutzt bestehenden
                  Tresor.
                </p>
              </button>
            </div>

            <HandoffProvisionGroupSelect
              value={selectedMessengerGroupId}
              onChange={setSelectedMessengerGroupId}
              bossAddress={defaults.handoffBoss}
              defaultGroupName={`${bezeichnung.trim() || preset.label} Gruppe`}
              teamMailboxOptions={teamMailboxOptions}
              defaultTeamMailboxId={defaultTeamMailboxId}
              hint="Beim Team-Wallet wird die Helfer-Adresse der Gruppe hinzugefügt; beim Nur-ZIP nur das Gruppen-JSON im Export."
            />

            {deliverMode === 'team-wallet' && !provisionRegistry.registryUnlocked ? (
              <p className="text-xs text-amber-700 dark:text-amber-200">
                Registry noch gesperrt — Schritt 4 entsperren oder anlegen.
              </p>
            ) : null}

            {zipOnlyDone ? (
              <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
                ZIP gespeichert. Helfer: Einstellungen → Handoff importieren → eigene Wallet beim Entsperren.
              </p>
            ) : null}

            {statusMsg ? (
              <p className="text-xs text-destructive" role="alert">
                {statusMsg}
              </p>
            ) : null}
            {p.onOpenExpert ? (
              <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs" onClick={p.onOpenExpert}>
                Passwort-ZIP, Partner, IOTA → Experten-Assistent
              </Button>
            ) : null}
          </div>
        ) : null}
      </OnboardingWizardShell>

      <HandoffProvisionResultDialog
        open={provisionResultOpen}
        onOpenChange={setProvisionResultOpen}
        address={provisionAddress}
        entryId={provisionEntryId}
        qrDataUrl={provisionQrDataUrl}
        resolveMasterPassword={() => provisionRegistry.activeMasterPassword()}
      />
    </>
  )
}
