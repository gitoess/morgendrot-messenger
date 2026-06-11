import type { ApiStatus } from '@/frontend/lib/api'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import type { StandaloneSmartphoneHandoffZipBody } from '@/frontend/lib/api/standalone-smartphone-handoff'
import {
  buildTeamMailboxOptions,
  defaultSelectedTeamMailboxIds,
  formatTeamMailboxIds,
  pickPrimaryMailboxId,
  buildDefaultPartnerAddresses,
} from '@/frontend/lib/handoff-export-autofill'
import {
  resolveHandoffExportParams,
  type HandoffExportTuning,
} from '@/frontend/lib/handoff-export-params'
import {
  handoffPresetUsesTeamMailboxes,
  getHandoffPreset,
  type HandoffEinsatzPresetId,
} from '@/frontend/lib/handoff-export-presets'
import { HANDOFF_README_IOTA_ARCHIV_BLOCK } from '@/frontend/lib/handoff-lora-psk-copy'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'
import { resolveMessengerGroupHandoffJson } from '@/frontend/lib/messenger-group-handoff'
import { getActiveMessengerGroup } from '@/frontend/lib/messenger-group-store'

const ADDR = /^0x[a-fA-F0-9]{64}$/i

/** Standard-Handoff-Body für den Provision-Wizard (Boss-Defaults aus Snapshot). */
export function buildWizardHandoffExportBody(opts: {
  apiSnapshot: ApiStatus | null | undefined
  contactDirectory?: Record<string, ContactMeshEntryClient>
  presetId: HandoffEinsatzPresetId
  bezeichnung: string
  tuning?: HandoffExportTuning
  ids?: {
    rpcUrl?: string
    mailboxId?: string
    commandRegistryId?: string
    vaultRegistryId?: string
    packageId?: string
    directIotaRpcUrl?: string
  }
  /** Provision-Wizard: frisch erzeugte Helfer-Adresse in Gruppenliste. */
  helperAddress?: string
}): StandaloneSmartphoneHandoffZipBody {
  const tuning = opts.tuning ?? {}
  const resolved = resolveHandoffExportParams(opts.presetId, tuning)
  const useTeam = handoffPresetUsesTeamMailboxes(opts.presetId, resolved.omitTeamMailboxes)
  const teamOpts = buildTeamMailboxOptions(opts.apiSnapshot, readMyTeamMailboxes())
  const selectedTeamIds = defaultSelectedTeamMailboxIds(teamOpts)
  const mailboxFromIds = opts.ids?.mailboxId?.trim()
  const primaryMb =
    (useTeam ? pickPrimaryMailboxId(selectedTeamIds) : undefined) ||
    (mailboxFromIds && ADDR.test(mailboxFromIds) ? mailboxFromIds : undefined) ||
    (opts.apiSnapshot?.mailboxId && ADDR.test(opts.apiSnapshot.mailboxId)
      ? opts.apiSnapshot.mailboxId
      : undefined)
  const teamIds = useTeam ? formatTeamMailboxIds(selectedTeamIds) : undefined
  const boss =
    opts.apiSnapshot?.myAddressFull?.trim() ||
    opts.apiSnapshot?.myAddress?.trim() ||
    undefined
  const meshFirst = resolved.transportProfile === 'mesh-first'
  const pkg =
    opts.ids?.packageId?.trim() ||
    opts.apiSnapshot?.packageId?.trim() ||
    undefined

  const activeGroup = getActiveMessengerGroup()
  const teamMbForGroup =
    activeGroup?.teamMailboxObjectId?.trim() ||
    (useTeam ? pickPrimaryMailboxId(selectedTeamIds) : undefined) ||
    undefined
  const partnerCsv = buildDefaultPartnerAddresses(opts.apiSnapshot, opts.contactDirectory, boss) || ''
  const memberPool = [
    boss,
    opts.helperAddress?.trim(),
    ...partnerCsv.split(/[\s,;]+/),
    ...(activeGroup?.memberAddresses ?? []),
  ].filter(Boolean) as string[]
  const messengerGroupHandoff = resolveMessengerGroupHandoffJson({
    handoffLabel: opts.bezeichnung.trim() || getHandoffPreset(opts.presetId).label,
    teamMailboxObjectId: teamMbForGroup,
    memberAddresses: memberPool,
  })

  return {
    handoffLabel: opts.bezeichnung.trim() || undefined,
    rpcUrl: opts.ids?.rpcUrl?.trim() || undefined,
    packageSource: pkg ? 'custom' : 'boss',
    customPackageId: pkg,
    historyFromNewest: 0,
    bossAddress: boss,
    partnerAddresses: buildDefaultPartnerAddresses(opts.apiSnapshot, opts.contactDirectory, boss) || undefined,
    mailboxId: useTeam ? (primaryMb ?? '') : '',
    teamMailboxIds: teamIds,
    commandRegistryId: opts.ids?.commandRegistryId?.trim() || undefined,
    vaultRegistryId: opts.ids?.vaultRegistryId?.trim() || undefined,
    nextPublicDirectIotaRpcUrl: opts.ids?.directIotaRpcUrl?.trim() || undefined,
    helperRole: resolved.helperRole,
    roleId: resolved.roleId,
    deploymentProfile: resolved.deploymentProfile,
    uiVariant: resolved.uiVariant,
    transportProfile: resolved.transportProfile,
    simpleMode: resolved.simpleMode,
    includeIotaArchivReadme: meshFirst,
    readmeExtra: meshFirst ? HANDOFF_README_IOTA_ARCHIV_BLOCK : undefined,
    messengerGroupHandoff,
    exportTtlDays: opts.apiSnapshot?.einsatzConfig?.defaultTtlDays ?? 30,
    exportEnablePurge: opts.apiSnapshot?.einsatzConfig?.enablePurge !== false,
  }
}
