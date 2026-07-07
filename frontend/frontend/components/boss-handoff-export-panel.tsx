'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Download, Package, QrCode, Save, Send, Users } from 'lucide-react'
import { LanInstallQrPanel } from '@/frontend/components/lan-install-qr-panel'
import type { ApiStatus } from '@/frontend/lib/api'
import { getStatus } from '@/frontend/lib/api'
import type { StandaloneSmartphoneHandoffZipBody } from '@/frontend/lib/api/standalone-smartphone-handoff'
import { downloadHandoffZipExport } from '@/frontend/lib/handoff-export-download'
import { sendHandoffZipViaIota } from '@/frontend/lib/handoff-iota-send'
import { validateHandoffExportPassword } from '@/frontend/lib/handoff-zip-crypto'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import {
  buildTeamMailboxOptions,
  defaultSelectedTeamMailboxIds,
} from '@/frontend/lib/handoff-export-autofill'
import {
  formatHandoffAddressShort,
  parsePartnerAddressCsv,
} from '@/frontend/lib/handoff-export-display'
import {
  buildHandoffPartnerOptions,
  partnerAddressesToCsv,
} from '@/frontend/lib/handoff-export-partners'
import { fetchEinsatzRoleTemplates, saveEinsatzRoleTemplates } from '@/frontend/lib/api/einsatz-role-templates'
import type { EinsatzRoleTemplate } from '@morgendrot/shared/einsatz-role-templates'
import {
  resolveHandoffExportParams,
  type HandoffExportTuning,
} from '@/frontend/lib/handoff-export-params'
import { HandoffCapabilitiesMatrixPicker } from '@/frontend/components/handoff-capabilities-matrix-picker'
import { HandoffRoleIdBitPicker } from '@/frontend/components/handoff-role-id-bit-picker'
import {
  resolveHandoffExportCapabilities,
} from '@/frontend/lib/handoff-export-capabilities'
import type { HandoffCapabilityPreset } from '@/frontend/lib/handoff-capability-presets'
import type { MessengerCapabilitiesOverride } from '@morgendrot/shared/messenger-capabilities-matrix'
import {
  getHandoffPreset,
  HANDOFF_EINSATZ_PRESETS,
  handoffPresetUsesTeamMailboxes,
  suggestHandoffBezeichnung,
  type HandoffEinsatzPresetId,
  type HandoffHelperRole,
} from '@/frontend/lib/handoff-export-presets'
import { HANDOFF_PRESET_VISUAL } from '@/frontend/lib/handoff-preset-ui'
import { readHandoffLastPresetId, writeHandoffLastPresetId } from '@/frontend/lib/handoff-last-preset'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'
import {
  applyEinsatzHandoffTemplate,
  buildEinsatzTemplateFromHandoffExport,
  buildHandoffTemplateSnapshotFromExport,
  slugifyHandoffTemplateId,
  suggestHandoffTemplateLabel,
  upsertEinsatzRoleTemplate,
} from '@/frontend/lib/handoff-export-to-template'
import { validateEinsatzRoleTemplatesBody } from '@/frontend/lib/einsatz-role-templates-validate'
import { canEditEinsatzRoleTemplates } from '@/frontend/lib/messenger-role-capabilities'
import { cn } from '@/lib/utils'
import { provisionNewHandoffDevice } from '@/frontend/lib/handoff-provision-new-device'
import { useHandoffProvisionRegistryAccess } from '@/frontend/lib/handoff-provision-registry-access'
import { HandoffProvisionRegistrySection } from '@/frontend/components/handoff-provision-registry-section'
import { HandoffProvisionResultDialog } from '@/frontend/components/handoff-provision-result-dialog'
import {
    defaultHandoffRpcForChainMode,
    describeEinsatzChainModeBanner,
    EINSATZ_CHAIN_MODE_LABELS,
    type EinsatzChainMode,
    parseEinsatzChainMode,
} from '@morgendrot/shared/einsatz-chain-mode'
import { persistEinsatzChainMode } from '@/frontend/lib/einsatz-chain-mode-local'
import { buildHandoffZipExportBody } from '@/frontend/lib/handoff-export-build-body'
import { fetchHandoffCurrentIdsDefaults } from '@/frontend/lib/handoff-export-defaults'

type HandoffPkgSource = 'boss' | 'custom'

export type BossHandoffExportPanelProps = {
  apiSnapshot?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  defaultExpanded?: boolean
  forceExpanded?: boolean
  embedded?: boolean
  /** Einsatzleitung: eine scrollbare Seite, Rechte-Matrix sichtbar */
  layout?: 'steps' | 'compact'
}

export function BossHandoffExportPanel(p: BossHandoffExportPanelProps) {
  const compact = p.layout === 'compact'
  const defaultPreset = getHandoffPreset('helfer')
  const [presetId, setPresetId] = useState<HandoffEinsatzPresetId>('helfer')
  const [bezeichnung, setBezeichnung] = useState(() => suggestHandoffBezeichnung(defaultPreset))
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [selectedPartnerAddrs, setSelectedPartnerAddrs] = useState<Set<string>>(() => new Set())
  const [handoffBusy, setHandoffBusy] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2>(1)
  const [statusMsg, setStatusMsg] = useState('')

  const [handoffRpc, setHandoffRpc] = useState('')
  const [einsatzChainMode, setEinsatzChainMode] = useState<EinsatzChainMode>('mainnet-direct')
  const [handoffPkgSource, setHandoffPkgSource] = useState<HandoffPkgSource>('boss')
  const [handoffPkgCustom, setHandoffPkgCustom] = useState('')
  const [handoffBoss, setHandoffBoss] = useState('')
  const [handoffMailbox, setHandoffMailbox] = useState('')
  const [handoffCmdReg, setHandoffCmdReg] = useState('')
  const [handoffVaultReg, setHandoffVaultReg] = useState('')
  const [handoffDirectIota, setHandoffDirectIota] = useState('')
  const [partnersManual, setPartnersManual] = useState('')
  const [iotaTargetInput, setIotaTargetInput] = useState('')
  const [includeIotaArchivReadme, setIncludeIotaArchivReadme] = useState(true)
  const [protectWithPassword, setProtectWithPassword] = useState(false)
  const [handoffPassword, setHandoffPassword] = useState('')
  const [handoffPasswordConfirm, setHandoffPasswordConfirm] = useState('')
  const [lastDownloadPresetId, setLastDownloadPresetId] = useState<HandoffEinsatzPresetId | null>(() =>
    readHandoffLastPresetId()
  )
  const [savedTemplates, setSavedTemplates] = useState<EinsatzRoleTemplate[]>([])
  const [tuningRoleId, setTuningRoleId] = useState<number | null>(null)
  const [tuningHelperRole, setTuningHelperRole] = useState<HandoffHelperRole | ''>('')
  const [tuningSimpleMode, setTuningSimpleMode] = useState<'preset' | 'true' | 'false'>('preset')
  const [omitTeamMailboxes, setOmitTeamMailboxes] = useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [templateSaveLabel, setTemplateSaveLabel] = useState('')
  const [templateSaveId, setTemplateSaveId] = useState('')
  const [templateSaveBusy, setTemplateSaveBusy] = useState(false)
  const [capabilitiesOverride, setCapabilitiesOverride] = useState<MessengerCapabilitiesOverride | null>(null)
  const [provisionResultOpen, setProvisionResultOpen] = useState(false)
  const [provisionAddress, setProvisionAddress] = useState('')
  const [provisionEntryId, setProvisionEntryId] = useState<string | null>(null)
  const [provisionQrDataUrl, setProvisionQrDataUrl] = useState('')

  const provisionRegistry = useHandoffProvisionRegistryAccess()

  const labelEdited = useRef(false)
  const canSaveTemplates = canEditEinsatzRoleTemplates(p.apiSnapshot)
  const seeded = useRef(false)

  const preset = useMemo(() => getHandoffPreset(presetId), [presetId])
  const presetVisual = HANDOFF_PRESET_VISUAL[presetId]
  const exportTuning = useMemo((): HandoffExportTuning => {
    const t: HandoffExportTuning = { omitTeamMailboxes }
    if (tuningRoleId != null) t.roleId = tuningRoleId
    if (tuningHelperRole) t.helperRole = tuningHelperRole
    if (tuningSimpleMode === 'true') t.simpleMode = true
    if (tuningSimpleMode === 'false') t.simpleMode = false
    return t
  }, [tuningRoleId, tuningHelperRole, tuningSimpleMode, omitTeamMailboxes])

  const resolvedParams = useMemo(
    () => resolveHandoffExportParams(presetId, exportTuning),
    [presetId, exportTuning]
  )

  const capabilityContext = useMemo(
    () => ({
      roleId: resolvedParams.roleId,
      simpleMode: resolvedParams.simpleMode,
      transportProfile: resolvedParams.transportProfile,
      helperRole: resolvedParams.helperRole,
    }),
    [resolvedParams]
  )

  const resolvedCapabilities = useMemo(
    () => resolveHandoffExportCapabilities(capabilityContext, capabilitiesOverride),
    [capabilityContext, capabilitiesOverride]
  )

  const usesTeamMb = handoffPresetUsesTeamMailboxes(presetId, resolvedParams.omitTeamMailboxes)

  const teamMailboxOptions = useMemo(
    () => buildTeamMailboxOptions(p.apiSnapshot, readMyTeamMailboxes()),
    [p.apiSnapshot]
  )

  const bossAddress = useMemo(
    () => p.apiSnapshot?.myAddressFull?.trim() || p.apiSnapshot?.myAddress?.trim() || handoffBoss.trim(),
    [p.apiSnapshot?.myAddressFull, p.apiSnapshot?.myAddress, handoffBoss]
  )

  const partnerOptions = useMemo(
    () => buildHandoffPartnerOptions(p.apiSnapshot, p.contactDirectory, bossAddress),
    [p.apiSnapshot, p.contactDirectory, bossAddress]
  )

  const partnerExportCsv = useMemo(
    () => partnerAddressesToCsv(selectedPartnerAddrs),
    [selectedPartnerAddrs]
  )

  const einsatzChainModeBanner = useMemo(
    () => describeEinsatzChainModeBanner(einsatzChainMode, handoffRpc),
    [einsatzChainMode, handoffRpc]
  )

  const bossDefaultTtlDays = p.apiSnapshot?.einsatzConfig?.defaultTtlDays ?? 30

  const applyPreset = useCallback((id: HandoffEinsatzPresetId, resetLabel = false, resetTuning = true) => {
    const next = getHandoffPreset(id)
    setPresetId(id)
    if (resetLabel || !labelEdited.current) {
      setBezeichnung(suggestHandoffBezeichnung(next))
      labelEdited.current = false
    }
    if (resetTuning) {
      setTuningRoleId(null)
      setTuningHelperRole('')
      setTuningSimpleMode('preset')
      setCapabilitiesOverride(null)
    }
  }, [])

  const applyCapabilityPreset = useCallback((capPreset: HandoffCapabilityPreset) => {
    if (capPreset.apply.roleId != null) {
      const base = getHandoffPreset(presetId).roleId
      setTuningRoleId(capPreset.apply.roleId === base ? null : capPreset.apply.roleId)
    }
    setCapabilitiesOverride(capPreset.apply.override)
  }, [presetId])

  const openSaveTemplateForm = useCallback(() => {
    const label = suggestHandoffTemplateLabel({
      bezeichnung,
      presetLabel: preset.label,
      roleId: resolvedParams.roleId,
      helperRole: resolvedParams.helperRole,
    })
    setTemplateSaveLabel(label)
    setTemplateSaveId(slugifyHandoffTemplateId(label))
    setSaveTemplateOpen(true)
  }, [bezeichnung, preset.label, resolvedParams.roleId, resolvedParams.helperRole])

  const onSaveHandoffTemplate = useCallback(async () => {
    if (!canSaveTemplates) {
      setStatusMsg('Vorlagen speichern nur für Boss (configChange).')
      return
    }
    const handoffSnapshot = buildHandoffTemplateSnapshotFromExport({
      presetId,
      bezeichnung,
      resolvedParams,
      tuningRoleId,
      tuningHelperRole,
      tuningSimpleMode,
      capabilitiesOverride,
      selectedTeamIds,
      selectedPartnerAddresses: [...selectedPartnerAddrs],
      includeIotaArchivReadme,
      handoffRpc,
      handoffPkgSource,
      handoffPkgCustom,
      handoffBoss,
      handoffMailbox,
      handoffCmdReg,
      handoffVaultReg,
      handoffDirectIota,
    })
    const built = buildEinsatzTemplateFromHandoffExport({
      id: templateSaveId,
      label: templateSaveLabel,
      helperRole: resolvedParams.helperRole,
      roleId: resolvedParams.roleId,
      deploymentChannelTag: bezeichnung.trim() || undefined,
      handoffSnapshot,
    })
    const merged = upsertEinsatzRoleTemplate(savedTemplates, built)
    const validated = validateEinsatzRoleTemplatesBody({ templates: merged })
    if (!validated.ok) {
      setStatusMsg(validated.error)
      return
    }
    setTemplateSaveBusy(true)
    setStatusMsg('')
    try {
      const res = await saveEinsatzRoleTemplates(validated.templates)
      if (!res.ok) {
        setStatusMsg(res.error || 'Speichern fehlgeschlagen.')
        return
      }
      setSavedTemplates(res.templates ?? validated.templates)
      setSaveTemplateOpen(false)
      setStatusMsg(
        `Vorlage „${built.label}" gespeichert (Profil, Rechte, Partner/Team) — im Dropdown wählbar.`
      )
    } finally {
      setTemplateSaveBusy(false)
    }
  }, [
    canSaveTemplates,
    templateSaveId,
    templateSaveLabel,
    resolvedParams,
    presetId,
    bezeichnung,
    tuningRoleId,
    tuningHelperRole,
    tuningSimpleMode,
    capabilitiesOverride,
    selectedTeamIds,
    selectedPartnerAddrs,
    includeIotaArchivReadme,
    handoffRpc,
    handoffPkgSource,
    handoffPkgCustom,
    handoffBoss,
    handoffMailbox,
    handoffCmdReg,
    handoffVaultReg,
    handoffDirectIota,
    savedTemplates,
  ])

  const applySavedTemplate = useCallback((t: EinsatzRoleTemplate) => {
    const applied = applyEinsatzHandoffTemplate(t)
    applyPreset(applied.presetId, false, false)
    setTuningRoleId(applied.tuningRoleId)
    setTuningHelperRole(applied.tuningHelperRole)
    setTuningSimpleMode(applied.tuningSimpleMode)
    setOmitTeamMailboxes(applied.omitTeamMailboxes === true)
    setCapabilitiesOverride(applied.capabilitiesOverride)
    if (applied.selectedTeamIds?.length) setSelectedTeamIds(applied.selectedTeamIds)
    if (applied.selectedPartnerAddresses?.length) {
      setSelectedPartnerAddrs(new Set(applied.selectedPartnerAddresses))
    }
    if (applied.includeIotaArchivReadme != null) {
      setIncludeIotaArchivReadme(applied.includeIotaArchivReadme)
    }
    if (applied.handoffRpc) setHandoffRpc(applied.handoffRpc)
    if (applied.handoffPkgSource) setHandoffPkgSource(applied.handoffPkgSource)
    if (applied.handoffPkgCustom) setHandoffPkgCustom(applied.handoffPkgCustom)
    if (applied.handoffBoss) setHandoffBoss(applied.handoffBoss)
    if (applied.handoffMailbox) setHandoffMailbox(applied.handoffMailbox)
    if (applied.handoffCmdReg) setHandoffCmdReg(applied.handoffCmdReg)
    if (applied.handoffVaultReg) setHandoffVaultReg(applied.handoffVaultReg)
    if (applied.handoffDirectIota) setHandoffDirectIota(applied.handoffDirectIota)
    if (!labelEdited.current) {
      setBezeichnung(applied.bezeichnungSuggestion)
      labelEdited.current = false
    }
    setStatusMsg(
      applied.hasFullSnapshot
        ? `Vorlage „${t.label}" geladen (voller Handoff-Snapshot).`
        : `Vorlage „${t.label}" geladen (Legacy — nur Profil/ROLE_ID).`
    )
  }, [applyPreset])

  useEffect(() => {
    if (seeded.current) return
    seeded.current = true

    const full = p.apiSnapshot?.myAddressFull?.trim()
    if (full && /^0x[a-fA-F0-9]{64}$/i.test(full)) setHandoffBoss(full)

    const pkg = p.apiSnapshot?.packageId?.trim()
    if (pkg && /^0x[a-fA-F0-9]{64}$/i.test(pkg)) setHandoffPkgCustom(pkg)

    const opts = buildHandoffPartnerOptions(p.apiSnapshot, p.contactDirectory, full)
    /* Partner nicht vorauswählen — sonst landet IOTA-Versand an falschen Adressen (z. B. PARTNER_ADDRESS). */

    const teamOpts = buildTeamMailboxOptions(p.apiSnapshot, readMyTeamMailboxes())
    if (teamOpts.length) setSelectedTeamIds(defaultSelectedTeamMailboxIds(teamOpts))

    const last = readHandoffLastPresetId()
    if (last) applyPreset(last)
  }, [p.apiSnapshot, p.contactDirectory, applyPreset])

  useEffect(() => {
    let cancelled = false
    void fetchHandoffCurrentIdsDefaults().then((patch) => {
      if (cancelled) return
      const mb = patch.handoffMailbox?.trim()
      const cr = patch.handoffCmdReg?.trim()
      const vr = patch.handoffVaultReg?.trim()
      const rpc = patch.handoffRpc?.trim()
      if (mb && /^0x[a-fA-F0-9]{64}$/i.test(mb)) {
        setHandoffMailbox((prev) => prev || mb)
        setSelectedTeamIds((prev) => (prev.length ? prev : [mb]))
      }
      if (cr && /^0x[a-fA-F0-9]{64}$/i.test(cr)) setHandoffCmdReg((prev) => prev || cr)
      if (vr && /^0x[a-fA-F0-9]{64}$/i.test(vr)) setHandoffVaultReg((prev) => prev || vr)
      if (rpc) setHandoffRpc((prev) => prev || rpc)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await fetchEinsatzRoleTemplates()
      if (cancelled || !r.ok) return
      setSavedTemplates(r.templates ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleTeamMailbox = (id: string) => {
    setSelectedTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const togglePartner = (address: string) => {
    setSelectedPartnerAddrs((prev) => {
      const next = new Set(prev)
      if (next.has(address)) next.delete(address)
      else next.add(address)
      return next
    })
  }

  const mergeManualPartners = () => {
    const raw = partnersManual.trim()
    if (!raw) return
    const parsed = parsePartnerAddressCsv(raw)
    if (!parsed.length) {
      setStatusMsg('Keine gültigen Adressen.')
      return
    }
    setSelectedPartnerAddrs((prev) => {
      const next = new Set(prev)
      for (const a of parsed) next.add(a)
      return next
    })
    setPartnersManual('')
  }

  const fillManualPartnersFromSelection = () => {
    setPartnersManual(partnerExportCsv)
  }

  const resolveIotaPartnerAddresses = useCallback((): string[] => {
    const fromInput = parsePartnerAddressCsv(iotaTargetInput)
    if (fromInput.length > 0) {
      return fromInput.map((a) => a.toLowerCase())
    }
    return [...selectedPartnerAddrs].map((a) => a.toLowerCase())
  }, [selectedPartnerAddrs, iotaTargetInput])

  const iotaRecipientCount = resolveIotaPartnerAddresses().length

  const buildExportBody = useCallback(
    (
      activePresetId: HandoffEinsatzPresetId,
      opts?: { helperAddress?: string }
    ): StandaloneSmartphoneHandoffZipBody =>
      buildHandoffZipExportBody({
        activePresetId,
        bezeichnung,
        exportTuning,
        capabilitiesOverride,
        selectedTeamIds,
        handoffBoss,
        handoffMailbox,
        handoffRpc,
        handoffPkgSource,
        handoffPkgCustom,
        handoffCmdReg,
        handoffVaultReg,
        handoffDirectIota,
        partnerExportCsv,
        includeIotaArchivReadme,
        protectWithPassword,
        einsatzChainMode,
        bossDefaultTtlDays,
        exportEnablePurge: p.apiSnapshot?.einsatzConfig?.enablePurge !== false,
        helperAddress: opts?.helperAddress,
      }),
    [
      bezeichnung,
      einsatzChainMode,
      handoffRpc,
      handoffPkgSource,
      handoffPkgCustom,
      handoffBoss,
      handoffMailbox,
      handoffCmdReg,
      handoffVaultReg,
      handoffDirectIota,
      partnerExportCsv,
      selectedTeamIds,
      includeIotaArchivReadme,
      protectWithPassword,
      exportTuning,
      capabilitiesOverride,
      bossDefaultTtlDays,
      p.apiSnapshot?.einsatzConfig?.enablePurge,
    ]
  )

  const validatePasswordIfNeeded = (): boolean => {
    if (!protectWithPassword) return true
    const pwErr = validateHandoffExportPassword(handoffPassword, handoffPasswordConfirm)
    if (pwErr) {
      setStatusMsg(pwErr)
      return false
    }
    return true
  }

  const downloadHandoffZip = async (activePresetId: HandoffEinsatzPresetId) => {
    if (!validatePasswordIfNeeded()) return
    setHandoffBusy(true)
    setStatusMsg('')
    const r = await downloadHandoffZipExport(
      buildExportBody(activePresetId),
      protectWithPassword ? { password: handoffPassword } : {}
    )
    setHandoffBusy(false)
    if (r.ok) {
      writeHandoffLastPresetId(activePresetId)
      setLastDownloadPresetId(activePresetId)
    }
    setStatusMsg(r.ok ? (protectWithPassword ? 'ZIP gespeichert (Passwort).' : 'ZIP gespeichert.') : r.error || 'Download fehlgeschlagen.')
  }

  const onDownload = () => downloadHandoffZip(presetId)

  const onProvisionNewDevice = async () => {
    if (!validatePasswordIfNeeded()) return
    if (!provisionRegistry.registryUnlocked) {
      if (!provisionRegistry.registryExists) {
        const init = await provisionRegistry.initRegistry()
        if (!init.ok) {
          setStatusMsg(init.error)
          return
        }
      } else {
        const unlock = await provisionRegistry.unlockRegistry()
        if (!unlock.ok) {
          setStatusMsg(unlock.error)
          return
        }
      }
    }
    setHandoffBusy(true)
    setStatusMsg('')
    try {
      const r = await provisionNewHandoffDevice({
        buildBody: (helperAddress) => buildExportBody(presetId, { helperAddress }),
        presetId,
        label: bezeichnung.trim() || preset.label,
        masterPassword: provisionRegistry.activeMasterPassword(),
        zipPassword: protectWithPassword ? handoffPassword : undefined,
      })
      if (!r.ok) {
        setStatusMsg(r.error)
        return
      }
      writeHandoffLastPresetId(presetId)
      setLastDownloadPresetId(presetId)
      setProvisionAddress(r.address)
      setProvisionEntryId(r.entryId)
      setProvisionQrDataUrl(r.qrDataUrl)
      setProvisionResultOpen(true)
      setStatusMsg(
        r.zipPasswordProtected
          ? 'Passwortgeschütztes ZIP — Handoff-Passwort dem Helfer mündlich mitteilen. Seed-QR: 60 Sekunden.'
          : 'ZIP heruntergeladen — Seed-QR dem Helfer zeigen (60 Sekunden).'
      )
    } finally {
      setHandoffBusy(false)
    }
  }

  const repeatPresetId = lastDownloadPresetId
  const showRepeatDownload =
    repeatPresetId != null && repeatPresetId !== presetId && HANDOFF_EINSATZ_PRESETS.some((x) => x.id === repeatPresetId)

  const onRepeatLastPresetDownload = async () => {
    if (!repeatPresetId) return
    await downloadHandoffZip(repeatPresetId)
  }

  const onSendViaIota = async () => {
    if (!validatePasswordIfNeeded()) return
    const recipients = resolveIotaPartnerAddresses()
    if (recipients.length === 0) {
      setStatusMsg('IOTA-Ziel: Partner ankreuzen oder 0x-Adresse eingeben (verschlüsselt, Handshake nötig).')
      return
    }
    setHandoffBusy(true)
    setStatusMsg('')
    const statusRes = await getStatus()
    const snap = statusRes.ok && statusRes.data ? statusRes.data : p.apiSnapshot
    const r = await sendHandoffZipViaIota({
      body: buildExportBody(presetId),
      password: protectWithPassword ? handoffPassword : undefined,
      partnerAddresses: recipients,
      handoffLabel: bezeichnung.trim() || undefined,
      apiStatus: snap ?? null,
      refreshApiStatus: async () => {
        await getStatus()
      },
    })
    setHandoffBusy(false)
    if (!r.ok) {
      setStatusMsg(r.error)
      return
    }
    writeHandoffLastPresetId(presetId)
    setLastDownloadPresetId(presetId)
    const failHint = r.failures.length > 0 ? ` (${r.failures.length} fehlgeschlagen)` : ''
    setStatusMsg(`An ${r.sent} Partner gesendet.${failHint}`)
  }

  return (
    <div
      className={cn(
        p.embedded ? '' : 'rounded-xl border border-border bg-card p-4',
        !p.embedded && !compact && `border-l-4 ${presetVisual.activeBg.split(' ').find((c) => c.startsWith('border-')) ?? 'border-l-purple-500/45'}`
      )}
    >
      <div className={cn(compact && p.embedded ? 'space-y-4' : 'flex items-start gap-3')}>
        {!compact ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300">
            <Package className="h-5 w-5" aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-4">
          {!compact ? (
          <div>
            <h3 className="text-base font-semibold text-foreground">Export-Assistent</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Schritt {wizardStep}/2 ·{' '}
              <Link
                href="/handbook?file=EXPORT-ASSISTENT-REFERENZ.md"
                className="text-primary underline hover:no-underline"
              >
                Referenz
              </Link>
            </p>
          </div>
          ) : null}

          {(compact || wizardStep === 1) ? (
          <>
          <div>
            <label htmlFor="handoff-bezeichnung" className="mb-1 block text-xs font-medium text-muted-foreground">
              Bezeichnung
            </label>
            <input
              id="handoff-bezeichnung"
              value={bezeichnung}
              onChange={(e) => {
                labelEdited.current = true
                setBezeichnung(e.target.value)
              }}
              placeholder="Einsatzname"
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
            />
          </div>

          <section className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              {savedTemplates.length > 0 ? (
                <select
                  className="min-w-[10rem] flex-1 rounded-lg border border-border bg-input px-2 py-1.5 text-sm"
                  defaultValue=""
                  aria-label="Vorlage"
                  onChange={(e) => {
                    const id = e.target.value
                    e.target.value = ''
                    const t = savedTemplates.find((x) => x.id === id)
                    if (t) applySavedTemplate(t)
                  }}
                >
                  <option value="">Vorlage</option>
                  {savedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {HANDOFF_EINSATZ_PRESETS.map((item) => {
                const vis = HANDOFF_PRESET_VISUAL[item.id]
                const active = presetId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyPreset(item.id)}
                    className={cn(
                      'rounded-lg border p-2.5 text-left transition-all',
                      compact ? 'min-h-[3rem]' : 'min-h-[88px]',
                      active ? cn('ring-2', vis.activeRing, vis.activeBg) : cn('bg-muted/15', vis.idleBorder)
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span aria-hidden>{vis.emoji}</span>
                      {item.label}
                    </span>
                    {!compact ? (
                      <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{item.hint}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </section>

          {compact ? (
            <details className="rounded-lg border border-border/60 px-3 py-2" open>
              <summary className="cursor-pointer select-none py-1 text-sm font-medium text-foreground">
                Rechte
              </summary>
              <div className="mt-2 border-t border-border/60 pt-2">
                <HandoffCapabilitiesMatrixPicker
                  minimal
                  effective={resolvedCapabilities}
                  capabilitiesOverride={capabilitiesOverride}
                  onCapabilitiesOverrideChange={setCapabilitiesOverride}
                  onApplyCapabilityPreset={applyCapabilityPreset}
                />
              </div>
            </details>
          ) : null}

          {!compact ? (
          <button
            type="button"
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => setWizardStep(2)}
          >
            Weiter
          </button>
          ) : null}
          </>
          ) : null}

          {(compact || wizardStep === 2) ? (
          <>
          {!compact ? (
          <button
            type="button"
            className="text-xs font-medium text-primary underline hover:no-underline"
            onClick={() => setWizardStep(1)}
          >
            ← Zurück
          </button>
          ) : null}

          <section className="space-y-3">
            {usesTeamMb && teamMailboxOptions.length ? (
              <fieldset>
                <legend className="mb-2 block text-xs font-medium text-muted-foreground">Team-Postfächer</legend>
                <ul className="space-y-1.5">
                  {teamMailboxOptions.map((opt) => (
                    <li key={opt.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedTeamIds.includes(opt.id)}
                          onChange={() => toggleTeamMailbox(opt.id)}
                        />
                        <span className="min-w-0 font-medium text-foreground" title={opt.id}>
                          {opt.label}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : null}

            <fieldset>
              <legend className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Partner
              </legend>
              {partnerOptions.length ? (
                <ul className="space-y-1.5">
                  {partnerOptions.map((opt) => (
                    <li key={opt.address}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selectedPartnerAddrs.has(opt.address)}
                          onChange={() => togglePartner(opt.address)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-foreground">{opt.label}</span>
                          <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                            {formatHandoffAddressShort(opt.address)}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  Keine Kontakte — Zieladresse unten für IOTA eingeben.
                </p>
              )}
              <label className="mt-2 block text-[11px] font-medium text-muted-foreground">
                IOTA-Ziel (0x…)
              </label>
              <input
                type="text"
                value={iotaTargetInput}
                onChange={(e) => setIotaTargetInput(e.target.value.trim())}
                placeholder="0x…64hex — Helfer-Wallet"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
                spellCheck={false}
                autoComplete="off"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                <strong>Andere</strong> Helfer-Wallet (nicht deine Boss-Adresse). Verschlüsselt — vorher
                Handshake/Connect im Chat mit genau dieser Adresse, oder <strong>ZIP/USB</strong>. Passwort =
                ZIP-Datei, nicht IOTA.
              </p>
            </fieldset>

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {preset.transportProfile === 'mesh-first' && !protectWithPassword ? (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeIotaArchivReadme}
                    onChange={(e) => setIncludeIotaArchivReadme(e.target.checked)}
                  />
                  IOTA-Archiv
                </label>
              ) : null}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={protectWithPassword}
                  onChange={(e) => setProtectWithPassword(e.target.checked)}
                />
                Passwort
              </label>
            </div>
            {protectWithPassword ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={handoffPassword}
                  onChange={(e) => setHandoffPassword(e.target.value)}
                  placeholder="Passwort"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={handoffPasswordConfirm}
                  onChange={(e) => setHandoffPasswordConfirm(e.target.value)}
                  placeholder="Wiederholen"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
                />
              </div>
            ) : null}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {compact ? (
              <button
                type="button"
                disabled={handoffBusy}
                onClick={() => void onProvisionNewDevice()}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50',
                  presetId === 'helfer'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-600/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                <QrCode className="h-4 w-4" aria-hidden />
                {handoffBusy ? '…' : 'ZIP + Seed + QR'}
              </button>
            ) : null}
            <button
              type="button"
              disabled={handoffBusy}
              onClick={() => void onDownload()}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50',
                !compact && presetId === 'helfer'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-600/90'
                  : compact
                    ? 'border border-border bg-background hover:bg-muted'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <Download className="h-4 w-4" aria-hidden />
              {handoffBusy ? '…' : compact ? 'Nur ZIP' : 'ZIP'}
            </button>
            {showRepeatDownload ? (
              <button
                type="button"
                disabled={handoffBusy}
                onClick={() => void onRepeatLastPresetDownload()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                {getHandoffPreset(repeatPresetId).label}
              </button>
            ) : null}
            <button
              type="button"
              disabled={handoffBusy || iotaRecipientCount === 0}
              onClick={() => void onSendViaIota()}
              title={
                iotaRecipientCount === 0
                  ? 'Partner oder IOTA-Zieladresse (0x…) erforderlich'
                  : 'Handoff-ZIP verschlüsselt an Partner senden'
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/45 bg-sky-500/15 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              <Send className="h-4 w-4 shrink-0" aria-hidden />
              {handoffBusy ? '…' : 'IOTA'}
            </button>
            <LanInstallQrPanel variant="inline" onStatus={(msg) => setStatusMsg(msg)} />
          </div>

          {statusMsg ? (
            <p className="text-xs text-muted-foreground" role="status">
              {statusMsg}
            </p>
          ) : null}

          {compact ? (
            <HandoffProvisionRegistrySection registry={provisionRegistry} />
          ) : null}

          <details className="rounded-lg border border-border/60 px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none py-1 font-medium text-foreground">
              Experte
            </summary>
            <div className="mt-3 space-y-3 border-t border-border/60 pt-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <HandoffRoleIdBitPicker
                    effectiveRoleId={resolvedParams.roleId}
                    presetRoleId={preset.roleId}
                    tuningRoleId={tuningRoleId}
                    onTuningRoleIdChange={setTuningRoleId}
                  />
                </div>
                {!compact ? (
                <div className="sm:col-span-2">
                  <HandoffCapabilitiesMatrixPicker
                    effective={resolvedCapabilities}
                    capabilitiesOverride={capabilitiesOverride}
                    onCapabilitiesOverrideChange={setCapabilitiesOverride}
                    onApplyCapabilityPreset={applyCapabilityPreset}
                  />
                </div>
                ) : null}
                <div>
                  <label className="mb-1 block text-muted-foreground">ROLE</label>
                  <select
                    value={tuningHelperRole}
                    onChange={(e) => setTuningHelperRole(e.target.value as HandoffHelperRole | '')}
                    className="w-full rounded-lg border border-border bg-input px-2 py-2"
                  >
                    <option value="">— wie Profil —</option>
                    <option value="messenger">messenger</option>
                    <option value="arbeiter">arbeiter</option>
                    <option value="kommandant">kommandant</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-muted-foreground">Simple Mode</label>
                  <select
                    value={tuningSimpleMode}
                    onChange={(e) => setTuningSimpleMode(e.target.value as 'preset' | 'true' | 'false')}
                    className="w-full rounded-lg border border-border bg-input px-2 py-2"
                  >
                    <option value="preset">Profil</option>
                    <option value="true">An</option>
                    <option value="false">Aus</option>
                  </select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={omitTeamMailboxes}
                    onChange={(e) => setOmitTeamMailboxes(e.target.checked)}
                  />
                  Ohne Team-Mailboxen
                </label>
              </div>

              {canSaveTemplates ? (
                <div className="rounded-lg border border-violet-500/25 bg-violet-500/10 p-3">
                  <button
                    type="button"
                    onClick={() => (saveTemplateOpen ? setSaveTemplateOpen(false) : openSaveTemplateForm())}
                    className="flex items-center gap-1.5 text-xs font-medium text-foreground"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden />
                    {saveTemplateOpen ? 'Abbrechen' : 'Als Vorlage speichern'}
                  </button>
                  {saveTemplateOpen ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input
                        value={templateSaveLabel}
                        onChange={(e) => {
                          setTemplateSaveLabel(e.target.value)
                          setTemplateSaveId(slugifyHandoffTemplateId(e.target.value))
                        }}
                        placeholder="Anzeigename"
                        className="rounded-lg border border-border bg-input px-2 py-2"
                      />
                      <input
                        value={templateSaveId}
                        onChange={(e) => setTemplateSaveId(slugifyHandoffTemplateId(e.target.value))}
                        placeholder="id"
                        className="rounded-lg border border-border bg-input px-2 py-2 font-mono"
                      />
                      <button
                        type="button"
                        disabled={templateSaveBusy || !templateSaveLabel.trim()}
                        onClick={() => void onSaveHandoffTemplate()}
                        className="sm:col-span-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {templateSaveBusy ? 'Speichere…' : 'Speichern'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <details className="rounded-lg border border-border/60 px-3 py-2">
                <summary className="cursor-pointer font-medium text-foreground">Chain-IDs</summary>
                <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
              <div>
                <label className="mb-1 block text-muted-foreground">Einsatz-Kettenmodus (H.33)</label>
                <select
                  value={einsatzChainMode}
                  onChange={(e) => {
                    const mode = parseEinsatzChainMode(e.target.value)
                    setEinsatzChainMode(mode)
                    persistEinsatzChainMode(mode)
                    if (!handoffRpc.trim()) {
                      setHandoffRpc(defaultHandoffRpcForChainMode(mode))
                    }
                  }}
                  className="w-full rounded-lg border border-border bg-input px-2 py-2"
                >
                  {(Object.keys(EINSATZ_CHAIN_MODE_LABELS) as EinsatzChainMode[]).map((id) => (
                    <option key={id} value={id}>
                      {EINSATZ_CHAIN_MODE_LABELS[id]}
                    </option>
                  ))}
                </select>
                <p
                  className={cn(
                    'mt-2 rounded-md border px-2 py-1.5 text-xs',
                    einsatzChainModeBanner.tone === 'testnet' &&
                      'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100',
                    einsatzChainModeBanner.tone === 'mainnet' &&
                      'border-primary/30 bg-primary/5 text-foreground',
                    einsatzChainModeBanner.tone === 'neutral' &&
                      'border-border text-muted-foreground'
                  )}
                >
                  <span className="font-medium">{einsatzChainModeBanner.title}</span>
                  {' — '}
                  {einsatzChainModeBanner.detail}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-muted-foreground">RPC</label>
                <input
                  value={handoffRpc}
                  onChange={(e) => setHandoffRpc(e.target.value)}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <input
                    type="radio"
                    name="handoff-pkg-einsatz"
                    checked={handoffPkgSource === 'boss'}
                    onChange={() => setHandoffPkgSource('boss')}
                  />
                  Boss-Package
                </label>
                <label className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <input
                    type="radio"
                    name="handoff-pkg-einsatz"
                    checked={handoffPkgSource === 'custom'}
                    onChange={() => setHandoffPkgSource('custom')}
                  />
                  Eigene PACKAGE_ID
                </label>
                {handoffPkgSource === 'custom' ? (
                  <input
                    value={handoffPkgCustom}
                    onChange={(e) => setHandoffPkgCustom(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                  />
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-muted-foreground">Boss</label>
                  <input
                    value={handoffBoss}
                    onChange={(e) => setHandoffBoss(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-muted-foreground">Mailbox</label>
                  <input
                    value={handoffMailbox}
                    onChange={(e) => setHandoffMailbox(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-muted-foreground">Command Registry</label>
                  <input
                    value={handoffCmdReg}
                    onChange={(e) => setHandoffCmdReg(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-muted-foreground">Vault Registry</label>
                  <input
                    value={handoffVaultReg}
                    onChange={(e) => setHandoffVaultReg(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-muted-foreground">Direct IOTA RPC</label>
                  <input
                    value={handoffDirectIota}
                    onChange={(e) => setHandoffDirectIota(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                  />
                </div>
              </div>
                </div>
              </details>

              <details className="rounded-lg border border-border/60 px-3 py-2">
                <summary className="cursor-pointer font-medium text-foreground">Partner (0x)</summary>
                <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                <textarea
                  value={partnersManual}
                  onChange={(e) => setPartnersManual(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={mergeManualPartners}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    Hinzufügen
                  </button>
                  {selectedPartnerAddrs.size > 0 ? (
                    <button
                      type="button"
                      onClick={fillManualPartnersFromSelection}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Auswahl kopieren
                    </button>
                  ) : null}
                </div>
                </div>
              </details>
            </div>
          </details>
          </>
          ) : null}
        </div>
      </div>

      {compact ? (
        <HandoffProvisionResultDialog
          open={provisionResultOpen}
          onOpenChange={setProvisionResultOpen}
          address={provisionAddress}
          entryId={provisionEntryId}
          qrDataUrl={provisionQrDataUrl}
          zipPasswordProtected={protectWithPassword}
          resolveMasterPassword={() => provisionRegistry.activeMasterPassword()}
        />
      ) : null}
    </div>
  )
}
