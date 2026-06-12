import type { HandoffHelperRole, HandoffEinsatzPresetId } from '@/frontend/lib/handoff-export-presets'
import { getHandoffPreset } from '@/frontend/lib/handoff-export-presets'
import { describeRoleIdBits } from '@/frontend/lib/handoff-role-id-bits'
import type { HandoffExportTuning, ResolvedHandoffExportParams } from '@/frontend/lib/handoff-export-params'
import type { EinsatzRoleTemplate, EinsatzHandoffTemplateSnapshot } from '@morgendrot/shared/einsatz-role-templates'
import { EINSATZ_HANDOFF_TEMPLATE_SNAPSHOT_VERSION } from '@morgendrot/shared/einsatz-handoff-template-snapshot'
import type { MessengerCapabilitiesOverride } from '@morgendrot/shared/messenger-capabilities-matrix'

/** Gültige `templates[].id` (wie `parseEinsatzRoleTemplates`). */
export function slugifyHandoffTemplateId(label: string): string {
  let s = label
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
  if (!s) return 'vorlage'
  if (!/^[a-z0-9]/.test(s)) s = `v-${s}`
  if (!/[a-z0-9]$/.test(s)) s = `${s.replace(/-+$/, '')}0`
  if (s.length > 63) s = s.slice(0, 63).replace(/-+$/, '')
  if (!/[a-z0-9]$/.test(s)) s = `${s}0`
  return s
}

export function helperRoleToChainRole(role: HandoffHelperRole): EinsatzRoleTemplate['chainRole'] {
  switch (role) {
    case 'kommandant':
      return 'kommandant'
    case 'arbeiter':
      return 'arbeiter'
    default:
      return 'user'
  }
}

export type HandoffExportTemplateSource = {
  presetId: HandoffEinsatzPresetId
  bezeichnung: string
  resolvedParams: ResolvedHandoffExportParams
  tuningRoleId: number | null
  tuningHelperRole: HandoffHelperRole | ''
  tuningSimpleMode: 'preset' | 'true' | 'false'
  capabilitiesOverride: MessengerCapabilitiesOverride | null
  selectedTeamIds: string[]
  selectedPartnerAddresses: string[]
  includeIotaArchivReadme: boolean
  handoffRpc: string
  handoffPkgSource: 'boss' | 'custom'
  handoffPkgCustom: string
  handoffBoss: string
  handoffMailbox: string
  handoffCmdReg: string
  handoffVaultReg: string
  handoffDirectIota: string
}

export function buildHandoffTemplateSnapshotFromExport(
  source: HandoffExportTemplateSource
): EinsatzHandoffTemplateSnapshot {
  const preset = getHandoffPreset(source.presetId)
  const tuning: NonNullable<EinsatzHandoffTemplateSnapshot['tuning']> = {}
  if (source.tuningRoleId != null && source.tuningRoleId !== preset.roleId) {
    tuning.roleId = source.tuningRoleId
  } else if (source.resolvedParams.roleId !== preset.roleId) {
    tuning.roleId = source.resolvedParams.roleId
  }
  const helperRole = source.tuningHelperRole || source.resolvedParams.helperRole
  if (helperRole !== preset.helperRole) tuning.helperRole = helperRole
  if (source.tuningSimpleMode === 'true') tuning.simpleMode = true
  if (source.tuningSimpleMode === 'false') tuning.simpleMode = false
  if (source.resolvedParams.omitTeamMailboxes) tuning.omitTeamMailboxes = true

  const exportBlock: NonNullable<EinsatzHandoffTemplateSnapshot['export']> = {}
  if (source.selectedTeamIds.length) {
    exportBlock.teamMailboxIds = source.selectedTeamIds.map((x) => x.toLowerCase())
  }
  if (source.selectedPartnerAddresses.length) {
    exportBlock.partnerAddresses = source.selectedPartnerAddresses.map((x) => x.toLowerCase())
  }
  if (source.includeIotaArchivReadme) exportBlock.includeIotaArchivReadme = true
  if (source.handoffRpc.trim()) exportBlock.handoffRpc = source.handoffRpc.trim()
  if (source.handoffPkgSource === 'custom') exportBlock.packageSource = 'custom'
  if (source.handoffPkgCustom.trim()) exportBlock.customPackageId = source.handoffPkgCustom.trim()
  if (source.handoffBoss.trim()) exportBlock.bossAddress = source.handoffBoss.trim()
  if (source.handoffMailbox.trim()) exportBlock.mailboxId = source.handoffMailbox.trim()
  if (source.handoffCmdReg.trim()) exportBlock.commandRegistryId = source.handoffCmdReg.trim()
  if (source.handoffVaultReg.trim()) exportBlock.vaultRegistryId = source.handoffVaultReg.trim()
  if (source.handoffDirectIota.trim()) exportBlock.directIotaRpcUrl = source.handoffDirectIota.trim()

  const bezeichnungHint = source.bezeichnung.trim().slice(0, 120) || undefined

  return {
    schemaVersion: EINSATZ_HANDOFF_TEMPLATE_SNAPSHOT_VERSION,
    presetId: source.presetId,
    ...(bezeichnungHint ? { bezeichnungHint } : {}),
    ...(Object.keys(tuning).length ? { tuning } : {}),
    ...(source.capabilitiesOverride ? { capabilitiesOverride: source.capabilitiesOverride } : {}),
    ...(Object.keys(exportBlock).length ? { export: exportBlock } : {}),
  }
}

export function buildEinsatzTemplateFromHandoffExport(input: {
  id: string
  label: string
  helperRole: HandoffHelperRole
  roleId: number
  deploymentChannelTag?: string
  handoffSnapshot?: EinsatzHandoffTemplateSnapshot
}): EinsatzRoleTemplate {
  const id = slugifyHandoffTemplateId(input.id || input.label)
  const label = input.label.trim().slice(0, 120) || 'Handoff-Vorlage'
  const tag = input.deploymentChannelTag?.trim().slice(0, 120)
  return {
    id,
    label,
    chainRole: helperRoleToChainRole(input.helperRole),
    roleId: Math.max(0, Math.min(63, Math.floor(input.roleId))),
    ...(tag ? { defaultDeploymentChannelTag: tag } : {}),
    ...(input.handoffSnapshot ? { handoffSnapshot: input.handoffSnapshot } : {}),
  }
}

export function suggestHandoffTemplateLabel(input: {
  bezeichnung: string
  presetLabel: string
  roleId: number
  helperRole: HandoffHelperRole
}): string {
  const bez = input.bezeichnung.trim()
  if (bez) return bez.slice(0, 120)
  const bits = describeRoleIdBits(input.roleId)
  return `${input.presetLabel} · ${input.helperRole} · ${bits}`.slice(0, 120)
}

export function upsertEinsatzRoleTemplate(
  existing: EinsatzRoleTemplate[],
  next: EinsatzRoleTemplate
): EinsatzRoleTemplate[] {
  const without = existing.filter((t) => t.id !== next.id)
  return [...without, next]
}

export type AppliedHandoffTemplate = {
  presetId: HandoffEinsatzPresetId
  tuning: HandoffExportTuning
  capabilitiesOverride: MessengerCapabilitiesOverride | null
  bezeichnungSuggestion: string
  selectedTeamIds?: string[]
  selectedPartnerAddresses?: string[]
  includeIotaArchivReadme?: boolean
  handoffRpc?: string
  handoffPkgSource?: 'boss' | 'custom'
  handoffPkgCustom?: string
  handoffBoss?: string
  handoffMailbox?: string
  handoffCmdReg?: string
  handoffVaultReg?: string
  handoffDirectIota?: string
  omitTeamMailboxes?: boolean
  tuningSimpleMode: 'preset' | 'true' | 'false'
  tuningHelperRole: HandoffHelperRole | ''
  tuningRoleId: number | null
  hasFullSnapshot: boolean
}

/** Vorlage laden — mit vollem Snapshot (Phase 4) oder Legacy-Feldern. */
export function applyEinsatzHandoffTemplate(t: EinsatzRoleTemplate): AppliedHandoffTemplate {
  const snap = t.handoffSnapshot
  if (snap) {
    const preset = getHandoffPreset(snap.presetId)
    const tuning: HandoffExportTuning = {}
    const snapTuning = snap.tuning ?? {}
    const roleId = snapTuning.roleId ?? t.roleId
    if (roleId !== preset.roleId) tuning.roleId = roleId
    const helperRole = snapTuning.helperRole ?? preset.helperRole
    if (helperRole !== preset.helperRole) tuning.helperRole = helperRole
    if (snapTuning.simpleMode === true) tuning.simpleMode = true
    if (snapTuning.simpleMode === false) tuning.simpleMode = false
    if (snapTuning.omitTeamMailboxes) tuning.omitTeamMailboxes = true

    const day = new Date().toISOString().slice(0, 10)
    const hint = snap.bezeichnungHint?.trim() || t.label
    const exp = snap.export

    return {
      presetId: snap.presetId,
      tuning,
      capabilitiesOverride: snap.capabilitiesOverride ?? null,
      bezeichnungSuggestion: `${hint}-${day}`,
      selectedTeamIds: exp?.teamMailboxIds,
      selectedPartnerAddresses: exp?.partnerAddresses,
      includeIotaArchivReadme: exp?.includeIotaArchivReadme,
      handoffRpc: exp?.handoffRpc,
      handoffPkgSource: exp?.packageSource,
      handoffPkgCustom: exp?.customPackageId,
      handoffBoss: exp?.bossAddress,
      handoffMailbox: exp?.mailboxId,
      handoffCmdReg: exp?.commandRegistryId,
      handoffVaultReg: exp?.vaultRegistryId,
      handoffDirectIota: exp?.directIotaRpcUrl,
      omitTeamMailboxes: snapTuning.omitTeamMailboxes === true,
      tuningSimpleMode:
        snapTuning.simpleMode === true ? 'true' : snapTuning.simpleMode === false ? 'false' : 'preset',
      tuningHelperRole: snapTuning.helperRole ?? '',
      tuningRoleId: snapTuning.roleId != null && snapTuning.roleId !== preset.roleId ? snapTuning.roleId : null,
      hasFullSnapshot: true,
    }
  }

  const legacy = legacyParamsFromEinsatzTemplate(t)
  const preset = getHandoffPreset(legacy.presetId)
  const rid = legacy.tuning.roleId ?? t.roleId
  return {
    presetId: legacy.presetId,
    tuning: legacy.tuning,
    capabilitiesOverride: null,
    bezeichnungSuggestion: `${t.label}-${new Date().toISOString().slice(0, 10)}`,
    tuningSimpleMode: 'preset',
    tuningHelperRole: legacy.tuning.helperRole ?? '',
    tuningRoleId: rid === preset.roleId ? null : rid,
    hasFullSnapshot: false,
  }
}

function legacyParamsFromEinsatzTemplate(t: EinsatzRoleTemplate): {
  presetId: HandoffEinsatzPresetId
  tuning: HandoffExportTuning
  label: string
} {
  const tuning: HandoffExportTuning = { roleId: t.roleId }
  switch (t.chainRole) {
    case 'kommandant':
      return { presetId: 'fuehrer', tuning, label: t.label }
    case 'arbeiter':
      return { presetId: 'helfer', tuning: { ...tuning, helperRole: 'arbeiter' }, label: t.label }
    case 'user':
      return { presetId: 'spezial', tuning: { ...tuning, helperRole: 'messenger' }, label: t.label }
    default:
      return { presetId: 'spezial', tuning, label: t.label }
  }
}
