import type { StandaloneSmartphoneHandoffZipBody } from '@/frontend/lib/api/standalone-smartphone-handoff'
import type { MessengerCapabilitiesOverride } from '@morgendrot/shared/messenger-capabilities-matrix'
import type { EinsatzChainMode } from '@morgendrot/shared/einsatz-chain-mode'
import {
  formatTeamMailboxIds,
  pickPrimaryMailboxId,
} from '@/frontend/lib/handoff-export-autofill'
import { resolveHandoffExportParams, type HandoffExportTuning } from '@/frontend/lib/handoff-export-params'
import {
  getHandoffPreset,
  handoffPresetUsesTeamMailboxes,
  type HandoffEinsatzPresetId,
} from '@/frontend/lib/handoff-export-presets'
import { HANDOFF_README_IOTA_ARCHIV_BLOCK } from '@/frontend/lib/handoff-lora-psk-copy'
import { resolveMessengerGroupHandoffJson } from '@/frontend/lib/messenger-group-handoff'

/** Gemeinsame ZIP-Body-Erzeugung — Schnell-Assistent + Experten-Panel (keine Duplikation). */
export type HandoffExportBodyBuildInput = {
  activePresetId: HandoffEinsatzPresetId
  bezeichnung: string
  exportTuning?: HandoffExportTuning
  capabilitiesOverride?: MessengerCapabilitiesOverride | null
  selectedTeamIds: string[]
  handoffBoss: string
  handoffMailbox: string
  handoffRpc: string
  handoffPkgSource: 'boss' | 'custom'
  handoffPkgCustom: string
  handoffCmdReg: string
  handoffVaultReg: string
  handoffDirectIota: string
  partnerExportCsv: string
  includeIotaArchivReadme: boolean
  protectWithPassword: boolean
  einsatzChainMode: EinsatzChainMode
  bossDefaultTtlDays: number
  exportEnablePurge: boolean
  helperAddress?: string
  messengerGroupId?: string
}

export function buildHandoffZipExportBody(input: HandoffExportBodyBuildInput): StandaloneSmartphoneHandoffZipBody {
  const tuning = input.exportTuning ?? {}
  const resolved = resolveHandoffExportParams(input.activePresetId, tuning)
  const useTeam = handoffPresetUsesTeamMailboxes(input.activePresetId, resolved.omitTeamMailboxes)
  const primaryMb = useTeam
    ? pickPrimaryMailboxId(input.selectedTeamIds) || input.handoffMailbox.trim() || undefined
    : undefined
  const teamIds = useTeam ? formatTeamMailboxIds(input.selectedTeamIds) : undefined
  const meshFirst = resolved.transportProfile === 'mesh-first'
  const memberPool = [
    input.handoffBoss.trim(),
    input.helperAddress?.trim(),
    ...input.partnerExportCsv.split(/[\s,;]+/),
  ].filter((x): x is string => Boolean(x))
  const messengerGroupHandoff = resolveMessengerGroupHandoffJson({
    handoffLabel: input.bezeichnung.trim() || getHandoffPreset(input.activePresetId).label,
    teamMailboxObjectId: primaryMb,
    memberAddresses: memberPool,
    messengerGroupId: input.messengerGroupId,
  })
  return {
    handoffLabel: input.bezeichnung.trim() || undefined,
    rpcUrl: input.handoffRpc.trim() || undefined,
    packageSource: input.handoffPkgSource,
    customPackageId: input.handoffPkgCustom.trim() || undefined,
    historyFromNewest: 0,
    bossAddress: input.handoffBoss.trim() || undefined,
    partnerAddresses: input.partnerExportCsv || undefined,
    mailboxId: useTeam ? (primaryMb ?? '') : '',
    teamMailboxIds: teamIds,
    commandRegistryId: input.handoffCmdReg.trim() || undefined,
    vaultRegistryId: input.handoffVaultReg.trim() || undefined,
    nextPublicDirectIotaRpcUrl: input.handoffDirectIota.trim() || undefined,
    helperRole: resolved.helperRole,
    roleId: resolved.roleId,
    deploymentProfile: resolved.deploymentProfile,
    uiVariant: resolved.uiVariant,
    transportProfile: resolved.transportProfile,
    simpleMode: resolved.simpleMode,
    capabilitiesOverride: input.capabilitiesOverride ?? undefined,
    includeIotaArchivReadme:
      !input.protectWithPassword && input.includeIotaArchivReadme && meshFirst,
    readmeExtra:
      !input.protectWithPassword && input.includeIotaArchivReadme && meshFirst
        ? HANDOFF_README_IOTA_ARCHIV_BLOCK
        : undefined,
    messengerGroupHandoff,
    exportTtlDays: input.bossDefaultTtlDays,
    exportEnablePurge: input.exportEnablePurge,
    einsatzChainMode: input.einsatzChainMode,
  }
}
