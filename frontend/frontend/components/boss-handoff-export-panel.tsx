'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Download, Package, Save, Send, Users } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { getStatus } from '@/frontend/lib/api'
import type { StandaloneSmartphoneHandoffZipBody } from '@/frontend/lib/api/standalone-smartphone-handoff'
import { downloadHandoffZipExport } from '@/frontend/lib/handoff-export-download'
import { sendHandoffZipViaIota } from '@/frontend/lib/handoff-iota-send'
import { validateHandoffExportPassword } from '@/frontend/lib/handoff-zip-crypto'
import { API_BASE } from '@/frontend/lib/api/api-base'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import {
  buildTeamMailboxOptions,
  defaultSelectedTeamMailboxIds,
  formatTeamMailboxIds,
  pickPrimaryMailboxId,
} from '@/frontend/lib/handoff-export-autofill'
import { resolveMessengerGroupHandoffJson } from '@/frontend/lib/messenger-group-handoff'
import {
  buildHandoffExportSummary,
  formatHandoffAddressShort,
  formatHandoffMailboxShort,
  parsePartnerAddressCsv,
} from '@/frontend/lib/handoff-export-display'
import {
  buildHandoffPartnerOptions,
  defaultSelectedPartnerAddresses,
  partnerAddressesToCsv,
} from '@/frontend/lib/handoff-export-partners'
import { fetchEinsatzRoleTemplates, saveEinsatzRoleTemplates } from '@/frontend/lib/api/einsatz-role-templates'
import type { EinsatzRoleTemplate } from '@morgendrot/shared/einsatz-role-templates'
import {
  handoffParamsFromEinsatzTemplate,
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
import {
  HANDOFF_MESHTASTIC_PSK_SHORT,
  HANDOFF_README_IOTA_ARCHIV_BLOCK,
} from '@/frontend/lib/handoff-lora-psk-copy'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'
import {
  buildEinsatzTemplateFromHandoffExport,
  slugifyHandoffTemplateId,
  suggestHandoffTemplateLabel,
  upsertEinsatzRoleTemplate,
} from '@/frontend/lib/handoff-export-to-template'
import { validateEinsatzRoleTemplatesBody } from '@/frontend/lib/einsatz-role-templates-validate'
import { canEditEinsatzRoleTemplates } from '@/frontend/lib/messenger-role-capabilities'
import { cn } from '@/lib/utils'

type HandoffPkgSource = 'boss' | 'custom'

export type BossHandoffExportPanelProps = {
  apiSnapshot?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  defaultExpanded?: boolean
  forceExpanded?: boolean
  embedded?: boolean
}

export function BossHandoffExportPanel(p: BossHandoffExportPanelProps) {
  const defaultPreset = getHandoffPreset('helfer')
  const [presetId, setPresetId] = useState<HandoffEinsatzPresetId>('helfer')
  const [bezeichnung, setBezeichnung] = useState(() => suggestHandoffBezeichnung(defaultPreset))
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [selectedPartnerAddrs, setSelectedPartnerAddrs] = useState<Set<string>>(() => new Set())
  const [handoffBusy, setHandoffBusy] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2>(1)
  const [statusMsg, setStatusMsg] = useState('')

  const [handoffRpc, setHandoffRpc] = useState('')
  const [handoffPkgSource, setHandoffPkgSource] = useState<HandoffPkgSource>('boss')
  const [handoffPkgCustom, setHandoffPkgCustom] = useState('')
  const [handoffBoss, setHandoffBoss] = useState('')
  const [handoffMailbox, setHandoffMailbox] = useState('')
  const [handoffCmdReg, setHandoffCmdReg] = useState('')
  const [handoffVaultReg, setHandoffVaultReg] = useState('')
  const [handoffDirectIota, setHandoffDirectIota] = useState('')
  const [partnersManual, setPartnersManual] = useState('')
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

  const summary = useMemo(
    () =>
      buildHandoffExportSummary({
        preset,
        bezeichnung,
        teamMailboxCount: usesTeamMb ? selectedTeamIds.length : 0,
        partnerCount: selectedPartnerAddrs.size,
        usesTeamMailboxes: usesTeamMb,
        includeIotaArchivReadme,
      }),
    [preset, bezeichnung, usesTeamMb, selectedTeamIds.length, selectedPartnerAddrs.size, includeIotaArchivReadme]
  )

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

  const applyCapabilityPreset = useCallback(
    (capPreset: HandoffCapabilityPreset) => {
      if (capPreset.apply.roleId != null) {
        const base = getHandoffPreset(presetId).roleId
        setTuningRoleId(capPreset.apply.roleId === base ? null : capPreset.apply.roleId)
      }
      setCapabilitiesOverride(capPreset.apply.override)
      setStatusMsg(`Profil „${capPreset.label}" — ${capPreset.hint}`)
    },
    [presetId]
  )

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
    const built = buildEinsatzTemplateFromHandoffExport({
      id: templateSaveId,
      label: templateSaveLabel,
      helperRole: resolvedParams.helperRole,
      roleId: resolvedParams.roleId,
      deploymentChannelTag: bezeichnung.trim() || undefined,
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
        `Vorlage „${built.label}" gespeichert (ROLE_ID=${built.roleId}, ${built.chainRole}) — im Dropdown wählbar.`
      )
    } finally {
      setTemplateSaveBusy(false)
    }
  }, [
    canSaveTemplates,
    templateSaveId,
    templateSaveLabel,
    resolvedParams.helperRole,
    resolvedParams.roleId,
    bezeichnung,
    savedTemplates,
  ])

  const applySavedTemplate = useCallback((t: EinsatzRoleTemplate) => {
    const mapped = handoffParamsFromEinsatzTemplate(t)
    applyPreset(mapped.presetId, false, false)
    const rid = mapped.tuning.roleId ?? t.roleId
    const base = getHandoffPreset(mapped.presetId).roleId
    setTuningRoleId(rid === base ? null : rid)
    setTuningHelperRole(mapped.tuning.helperRole ?? '')
    setTuningSimpleMode('preset')
    if (!labelEdited.current) {
      const day = new Date().toISOString().slice(0, 10)
      setBezeichnung(`${t.label}-${day}`)
      labelEdited.current = false
    }
    setStatusMsg(`Vorlage „${t.label}" geladen — Partner/Team-Mailboxen für diesen Einsatz anpassen.`)
  }, [applyPreset])

  useEffect(() => {
    if (seeded.current) return
    seeded.current = true

    const full = p.apiSnapshot?.myAddressFull?.trim()
    if (full && /^0x[a-fA-F0-9]{64}$/i.test(full)) setHandoffBoss(full)

    const pkg = p.apiSnapshot?.packageId?.trim()
    if (pkg && /^0x[a-fA-F0-9]{64}$/i.test(pkg)) setHandoffPkgCustom(pkg)

    const opts = buildHandoffPartnerOptions(p.apiSnapshot, p.contactDirectory, full)
    if (opts.length) setSelectedPartnerAddrs(new Set(defaultSelectedPartnerAddresses(opts)))

    const teamOpts = buildTeamMailboxOptions(p.apiSnapshot, readMyTeamMailboxes())
    if (teamOpts.length) setSelectedTeamIds(defaultSelectedTeamMailboxIds(teamOpts))

    const last = readHandoffLastPresetId()
    if (last) applyPreset(last)
  }, [p.apiSnapshot, p.contactDirectory, applyPreset])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/current-ids`)
        const j = (await r.json()) as {
          mailboxId?: string
          commandRegistryId?: string
          vaultRegistryId?: string
          rpcUrl?: string
        }
        if (cancelled || !r.ok) return
        const mb = String(j.mailboxId || '').trim()
        const cr = String(j.commandRegistryId || '').trim()
        const vr = String(j.vaultRegistryId || '').trim()
        const rpc = String(j.rpcUrl || '').trim()
        if (mb && /^0x[a-fA-F0-9]{64}$/i.test(mb)) {
          setHandoffMailbox((prev) => prev || mb)
          setSelectedTeamIds((prev) => (prev.length ? prev : [mb]))
        }
        if (cr && /^0x[a-fA-F0-9]{64}$/i.test(cr)) setHandoffCmdReg((prev) => prev || cr)
        if (vr && /^0x[a-fA-F0-9]{64}$/i.test(vr)) setHandoffVaultReg((prev) => prev || vr)
        if (rpc) setHandoffRpc((prev) => prev || rpc)
      } catch {
        /* optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await fetchEinsatzRoleTemplates()
      if (cancelled || !r.ok) return
      setSavedTemplates(r.templates)
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
    if (!raw) {
      setStatusMsg(
        'Textfeld ist leer. Partner wählen Sie oben per Checkbox — oder 0x-Adressen hier einfügen und erneut klicken.'
      )
      return
    }
    const parsed = parsePartnerAddressCsv(raw)
    if (!parsed.length) {
      setStatusMsg('Keine gültigen Adressen gefunden (je 0x + 64 Hex, durch Komma oder Leerzeichen getrennt).')
      return
    }
    setSelectedPartnerAddrs((prev) => {
      const next = new Set(prev)
      for (const a of parsed) next.add(a)
      return next
    })
    setPartnersManual('')
    setStatusMsg(
      `${parsed.length} Adresse(n) zur Partner-Auswahl hinzugefügt — oben unter „Partner im Einsatz“ prüfen.`
    )
  }

  const fillManualPartnersFromSelection = () => {
    setPartnersManual(partnerExportCsv)
    setStatusMsg('Aktuelle Partner-Auswahl ins Textfeld kopiert — dort bearbeiten und „Zur Auswahl hinzufügen“.')
  }

  const buildExportBody = useCallback(
    (activePresetId: HandoffEinsatzPresetId): StandaloneSmartphoneHandoffZipBody => {
      const resolved = resolveHandoffExportParams(activePresetId, exportTuning)
      const useTeam = handoffPresetUsesTeamMailboxes(activePresetId, resolved.omitTeamMailboxes)
      const primaryMb = useTeam ? pickPrimaryMailboxId(selectedTeamIds) || handoffMailbox.trim() || undefined : undefined
      const teamIds = useTeam ? formatTeamMailboxIds(selectedTeamIds) : undefined
      const meshFirst = resolved.transportProfile === 'mesh-first'
      const memberPool = [
        handoffBoss.trim(),
        ...partnerExportCsv.split(/[\s,;]+/),
      ].filter(Boolean)
      const messengerGroupHandoff = resolveMessengerGroupHandoffJson({
        handoffLabel: bezeichnung.trim() || getHandoffPreset(activePresetId).label,
        teamMailboxObjectId: primaryMb,
        memberAddresses: memberPool,
      })
      return {
        handoffLabel: bezeichnung.trim() || undefined,
        rpcUrl: handoffRpc.trim() || undefined,
        packageSource: handoffPkgSource,
        customPackageId: handoffPkgCustom.trim() || undefined,
        historyFromNewest: 0,
        bossAddress: handoffBoss.trim() || undefined,
        partnerAddresses: partnerExportCsv || undefined,
        mailboxId: useTeam ? (primaryMb ?? '') : '',
        teamMailboxIds: teamIds,
        commandRegistryId: handoffCmdReg.trim() || undefined,
        vaultRegistryId: handoffVaultReg.trim() || undefined,
        nextPublicDirectIotaRpcUrl: handoffDirectIota.trim() || undefined,
        helperRole: resolved.helperRole,
        roleId: resolved.roleId,
        deploymentProfile: resolved.deploymentProfile,
        uiVariant: resolved.uiVariant,
        transportProfile: resolved.transportProfile,
        simpleMode: resolved.simpleMode,
        capabilitiesOverride: capabilitiesOverride ?? undefined,
        includeIotaArchivReadme: !protectWithPassword && includeIotaArchivReadme && meshFirst,
        readmeExtra:
          !protectWithPassword && includeIotaArchivReadme && meshFirst
            ? HANDOFF_README_IOTA_ARCHIV_BLOCK
            : undefined,
        messengerGroupHandoff,
      }
    },
    [
      bezeichnung,
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
    setStatusMsg(
      r.ok
        ? protectWithPassword
          ? 'Geschütztes ZIP gespeichert — Passwort dem Helfer nur über einen separaten Kanal mitteilen (nicht in der ZIP).'
          : 'ZIP gespeichert — Handoff-.env und README bereit für den Helfer.'
        : r.error || 'Download fehlgeschlagen.'
    )
  }

  const onDownload = () => downloadHandoffZip(presetId)

  const repeatPresetId = lastDownloadPresetId
  const showRepeatDownload =
    repeatPresetId != null && repeatPresetId !== presetId && HANDOFF_EINSATZ_PRESETS.some((x) => x.id === repeatPresetId)

  const onRepeatLastPresetDownload = async () => {
    if (!repeatPresetId) return
    await downloadHandoffZip(repeatPresetId)
  }

  const onSendViaIota = async () => {
    if (!validatePasswordIfNeeded()) return
    if (selectedPartnerAddrs.size === 0) {
      setStatusMsg('Für IOTA-Handoff mindestens einen Partner oben auswählen (E2EE an deren Adresse).')
      return
    }
    setHandoffBusy(true)
    setStatusMsg('Sende Handoff-ZIP per IOTA …')
    const statusRes = await getStatus()
    const snap = statusRes.ok && statusRes.data ? statusRes.data : p.apiSnapshot
    const r = await sendHandoffZipViaIota({
      body: buildExportBody(presetId),
      password: protectWithPassword ? handoffPassword : undefined,
      partnerAddresses: [...selectedPartnerAddrs],
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
    const failHint =
      r.failures.length > 0
        ? ` (${r.failures.length} Partner fehlgeschlagen — Handshake/USB prüfen.)`
        : ''
    setStatusMsg(
      `Handoff an ${r.sent} Partner gesendet (E2EE). Helfer: Posteingang → Menü „Handoff importieren“. Passwort weiterhin separat.${failHint}`
    )
  }

  return (
    <div
      className={cn(
        p.embedded ? '' : 'rounded-xl border border-border bg-card p-4',
        !p.embedded && `border-l-4 ${presetVisual.activeBg.split(' ').find((c) => c.startsWith('border-')) ?? 'border-l-purple-500/45'}`
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300">
          <Package className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-foreground">Export-Assistent</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Schritt {wizardStep}/2 ·{' '}
              <Link
                href="/handbook?file=EXPORT-ASSISTENT-REFERENZ.md"
                className="text-primary underline hover:no-underline"
              >
                Alle Optionen (Referenz)
              </Link>
            </p>
            <div className="mt-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{summary.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{summary.detail}</p>
            </div>
          </div>

          {wizardStep === 1 ? (
          <>
          <div>
            <label htmlFor="handoff-bezeichnung" className="mb-1 block text-sm font-medium text-foreground">
              Bezeichnung
            </label>
            <input
              id="handoff-bezeichnung"
              value={bezeichnung}
              onChange={(e) => {
                labelEdited.current = true
                setBezeichnung(e.target.value)
              }}
              placeholder="z. B. THW Einsatz Süd"
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-foreground"
            />
          </div>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profil</h4>
            <div className="flex flex-wrap items-end gap-2">
              {savedTemplates.length > 0 ? (
                <label className="min-w-[12rem] flex-1 text-xs">
                  <span className="mb-1 block text-muted-foreground">Gespeicherte Vorlage</span>
                  <select
                    className="w-full rounded-lg border border-border bg-input px-2 py-2 text-sm"
                    defaultValue=""
                    onChange={(e) => {
                      const id = e.target.value
                      e.target.value = ''
                      const t = savedTemplates.find((x) => x.id === id)
                      if (t) applySavedTemplate(t)
                    }}
                  >
                    <option value="">— Vorlage laden (Reporter, Medic, …) —</option>
                    {savedTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
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
                      'rounded-xl border p-3 text-left transition-all min-h-[88px]',
                      active ? cn('ring-2', vis.activeRing, vis.activeBg) : cn('bg-muted/15', vis.idleBorder)
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span aria-hidden>{vis.emoji}</span>
                      {item.label}
                      {item.id === 'helfer' ? (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-200">
                          Standard
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{item.hint}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <button
            type="button"
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => setWizardStep(2)}
          >
            Weiter: Team &amp; Partner
          </button>
          </>
          ) : null}

          {wizardStep === 2 ? (
          <>
          <button
            type="button"
            className="text-xs font-medium text-primary underline hover:no-underline"
            onClick={() => setWizardStep(1)}
          >
            ← Profil &amp; Bezeichnung ändern
          </button>

          <section className="space-y-3">
            {usesTeamMb ? (
              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-foreground">Team-Postfächer</legend>
                {teamMailboxOptions.length ? (
                  <ul className="space-y-2">
                    {teamMailboxOptions.map((opt) => (
                      <li key={opt.id}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
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
                ) : (
                  <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Kein Team-Postfach lokal — primäre ID aus Boss-.env wird verwendet (falls gesetzt).
                  </p>
                )}
              </fieldset>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                Preset „{preset.label}“: kein Team-Postfach — Fokus privates Postfach / Funk.
              </p>
            )}

            <fieldset>
              <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                Partner im Einsatz
              </legend>
              <p className="mb-2 text-xs text-muted-foreground">
                Namen aus dem Telefonbuch — ins ZIP gehen nur die Adressen (0x…).
              </p>
              {partnerOptions.length ? (
                <ul className="space-y-2">
                  {partnerOptions.map((opt) => (
                    <li key={opt.address}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedPartnerAddrs.has(opt.address)}
                          onChange={() => togglePartner(opt.address)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-foreground">{opt.label}</span>
                          <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                            {formatHandoffAddressShort(opt.address)}
                            {opt.source === 'connected' ? (
                              <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">· verbunden</span>
                            ) : null}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
                  Noch keine Kontakte — im <strong>Telefonbuch</strong> anlegen, dann hier Partner mit Namen wählen.
                </p>
              )}
            </fieldset>

            <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/10 px-3 py-2 text-xs">
              {preset.transportProfile === 'mesh-first' && !protectWithPassword ? (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeIotaArchivReadme}
                    onChange={(e) => setIncludeIotaArchivReadme(e.target.checked)}
                  />
                  <span className="text-foreground">IOTA-Archiv im README</span>
                </label>
              ) : null}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={protectWithPassword}
                  onChange={(e) => setProtectWithPassword(e.target.checked)}
                />
                <span className="font-medium text-foreground">Handoff mit Passwort schützen (empfohlen)</span>
              </label>
              {protectWithPassword ? (
                <div className="grid gap-2 border-t border-border/60 pt-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-muted-foreground">Passwort</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={handoffPassword}
                      onChange={(e) => setHandoffPassword(e.target.value)}
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-muted-foreground">Passwort wiederholen</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={handoffPasswordConfirm}
                      onChange={(e) => setHandoffPasswordConfirm(e.target.value)}
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-foreground"
                    />
                  </div>
                  <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                    Passwort mündlich / zweiter Kanal — nicht in die ZIP schreiben.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={handoffBusy}
              onClick={() => void onDownload()}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-semibold shadow-sm disabled:opacity-50 sm:w-auto sm:min-w-[240px]',
                presetId === 'helfer' || presetId === 'arbeiter'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-600/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
              title={`Preset „${preset.label}“ und aktuelle Auswahl (Partner, Team, Technik)`}
            >
              <Download className="h-5 w-5" aria-hidden />
              {handoffBusy ? 'ZIP…' : `ZIP-Paket herunterladen (${preset.label})`}
            </button>
            {showRepeatDownload ? (
              <button
                type="button"
                disabled={handoffBusy}
                onClick={() => void onRepeatLastPresetDownload()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-400/50 bg-purple-500/15 px-5 py-3 text-sm font-semibold text-foreground hover:bg-purple-500/25 disabled:opacity-50 sm:w-auto"
                title="Lädt ZIP mit dem Preset des letzten Exports — ohne die aktuell gewählte Einsatz-Karte zu ändern"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                {handoffBusy ? 'ZIP…' : `Nochmal: ${getHandoffPreset(repeatPresetId).label}`}
              </button>
            ) : null}
            <button
              type="button"
              disabled={handoffBusy || selectedPartnerAddrs.size === 0}
              onClick={() => void onSendViaIota()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/45 bg-sky-500/15 px-5 py-3 text-sm font-semibold text-foreground hover:bg-sky-500/25 disabled:opacity-50 sm:w-auto"
              title="Gleiche ZIP-Nutzlast (~3 KB) verschlüsselt an ausgewählte Partner (Posteingang)"
            >
              <Send className="h-4 w-4 shrink-0" aria-hidden />
              {handoffBusy ? 'Sende…' : 'Per IOTA an Partner'}
            </button>
          </div>
          {showRepeatDownload ? (
            <p className="text-[11px] text-muted-foreground">
              <strong>Nochmal:</strong> letztes Preset ({getHandoffPreset(repeatPresetId).label}) — ohne die aktuelle
              Profil-Karte zu ändern.
            </p>
          ) : null}

          {statusMsg ? (
            <p className="text-sm text-muted-foreground" role="status">
              {statusMsg}
            </p>
          ) : null}

          <details className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none py-1 font-medium text-foreground">
              Experte (Feineinstellung, Vorlagen, LoRa, RPC)
            </summary>
            <div className="mt-3 space-y-4 border-t border-border/60 pt-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <HandoffRoleIdBitPicker
                    effectiveRoleId={resolvedParams.roleId}
                    presetRoleId={preset.roleId}
                    tuningRoleId={tuningRoleId}
                    onTuningRoleIdChange={setTuningRoleId}
                  />
                </div>
                <div className="sm:col-span-2">
                  <HandoffCapabilitiesMatrixPicker
                    effective={resolvedCapabilities}
                    capabilitiesOverride={capabilitiesOverride}
                    onCapabilitiesOverrideChange={setCapabilitiesOverride}
                    onApplyCapabilityPreset={applyCapabilityPreset}
                  />
                </div>
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
                    <option value="preset">wie Profil</option>
                    <option value="true">an</option>
                    <option value="false">aus</option>
                  </select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={omitTeamMailboxes}
                    onChange={(e) => setOmitTeamMailboxes(e.target.checked)}
                  />
                  <span>Keine Team-Mailboxen im ZIP</span>
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

              <p className="rounded-lg border border-sky-600/30 bg-sky-950/15 px-3 py-2 leading-snug text-muted-foreground">
                <strong className="text-foreground">LoRa:</strong> {HANDOFF_MESHTASTIC_PSK_SHORT}
              </p>
              <p className="text-muted-foreground">
                <Link href="/handbook?file=EXPORT-ASSISTENT-REFERENZ.md" className="text-primary underline">
                  Referenz
                </Link>
                {' · '}
                <Link
                  href="/handbook?file=MESSENGER-CHAT-HANDBUCH.md#handoff-env-move-und-package"
                  className="text-primary underline"
                >
                  .env vs. Move
                </Link>
              </p>
              <p className="text-muted-foreground">
                Nur bei Abweichung vom Boss-Setup. Bundle:{' '}
                <span className="font-mono">npm run bundle:standalone-smartphone</span>
              </p>
              <div>
                <p className="mb-2 text-muted-foreground">
                  <strong className="text-foreground">Partner:</strong> Standard ist die Auswahl oben (Checkboxen mit
                  Namen). Nur wenn eine Adresse <em>nicht</em> im Telefonbuch steht:
                </p>
                <textarea
                  value={partnersManual}
                  onChange={(e) => setPartnersManual(e.target.value)}
                  rows={3}
                  placeholder="0x…64hex, 0x…64hex (kommagetrennt)"
                  className="w-full resize-y rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={mergeManualPartners}
                    className="rounded-lg border border-emerald-600/45 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-emerald-500/25"
                  >
                    Zur Auswahl hinzufügen
                  </button>
                  {selectedPartnerAddrs.size > 0 ? (
                    <button
                      type="button"
                      onClick={fillManualPartnersFromSelection}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Auswahl ins Textfeld kopieren ({selectedPartnerAddrs.size})
                    </button>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Aktuell {selectedPartnerAddrs.size} Partner in der Auswahl (für das ZIP).
                </p>
              </div>
              <div>
                <label className="mb-1 block text-muted-foreground">RPC_URL</label>
                <input
                  value={handoffRpc}
                  onChange={(e) => setHandoffRpc(e.target.value)}
                  placeholder="https://api.testnet.iota.cafe"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                />
              </div>
              <div>
                <span className="mb-1 block font-medium text-foreground">Move-Package für den Handoff</span>
                <p className="mb-2 text-muted-foreground">
                  Standard: dieselbe <span className="font-mono">PACKAGE_ID</span> wie in Ihrer Boss-.env (empfohlen).
                  Nur ändern, wenn der Helfer ein <strong>anderes</strong> deploytes Package nutzen soll.
                </p>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <input
                    type="radio"
                    name="handoff-pkg-einsatz"
                    checked={handoffPkgSource === 'boss'}
                    onChange={() => setHandoffPkgSource('boss')}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-foreground">Boss-.env (Standard)</span>
                    <span className="mt-0.5 block text-muted-foreground">
                      {p.apiSnapshot?.packageId
                        ? `Aktuell: ${formatHandoffAddressShort(p.apiSnapshot.packageId)}`
                        : 'Aus Server-Konfiguration beim ZIP-Export'}
                    </span>
                  </span>
                </label>
                <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <input
                    type="radio"
                    name="handoff-pkg-einsatz"
                    checked={handoffPkgSource === 'custom'}
                    onChange={() => setHandoffPkgSource('custom')}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">Andere PACKAGE_ID eintragen</span>
                    <span className="mt-0.5 block text-muted-foreground">
                      Nur wenn der Helfer ein anderes Move-Package braucht (0x + 64 Hex).
                    </span>
                  </span>
                </label>
                {handoffPkgSource === 'custom' ? (
                  <input
                    value={handoffPkgCustom}
                    onChange={(e) => setHandoffPkgCustom(e.target.value)}
                    placeholder="0x…64 Hex"
                    className="mt-2 w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                  />
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-muted-foreground">BOSS_ADDRESS</label>
                <input
                  value={handoffBoss}
                  onChange={(e) => setHandoffBoss(e.target.value)}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-muted-foreground">MAILBOX_ID (primär)</label>
                  <input
                    value={handoffMailbox}
                    onChange={(e) => setHandoffMailbox(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-muted-foreground">COMMAND_REGISTRY_ID</label>
                  <input
                    value={handoffCmdReg}
                    onChange={(e) => setHandoffCmdReg(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-muted-foreground">VAULT_REGISTRY_ID</label>
                  <input
                    value={handoffVaultReg}
                    onChange={(e) => setHandoffVaultReg(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-muted-foreground">NEXT_PUBLIC_DIRECT_IOTA_RPC_URL</label>
                  <input
                    value={handoffDirectIota}
                    onChange={(e) => setHandoffDirectIota(e.target.value)}
                    placeholder="optional PWA Light-Client"
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-foreground"
                  />
                </div>
              </div>
            </div>
          </details>
          </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
