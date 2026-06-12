import type { HandoffEinsatzPresetId, HandoffHelperRole, HandoffTransportProfile } from '@/frontend/lib/handoff-export-presets'
import { getHandoffPreset } from '@/frontend/lib/handoff-export-presets'
import type { EinsatzRoleTemplate } from '@morgendrot/shared/einsatz-role-templates'

/** Feineinstellung nach Basis-Karte (Hybrid-Export). */
export type HandoffExportTuning = {
  roleId?: number
  helperRole?: HandoffHelperRole
  simpleMode?: boolean
  transportProfile?: HandoffTransportProfile
  uiVariant?: 'full' | 'messenger'
  /** Keine TEAM_MAILBOX_IDS / primäre MB im ZIP */
  omitTeamMailboxes?: boolean
}

export type ResolvedHandoffExportParams = {
  helperRole: HandoffHelperRole
  roleId: number
  deploymentProfile: 'einsatz'
  uiVariant: 'full' | 'messenger'
  transportProfile: HandoffTransportProfile
  simpleMode: boolean
  omitTeamMailboxes: boolean
}

export function resolveHandoffExportParams(
  presetId: HandoffEinsatzPresetId,
  tuning: HandoffExportTuning = {}
): ResolvedHandoffExportParams {
  const preset = getHandoffPreset(presetId)
  const roleId =
    tuning.roleId != null && Number.isFinite(tuning.roleId)
      ? Math.max(0, Math.min(63, Math.floor(tuning.roleId)))
      : preset.roleId
  return {
    helperRole: tuning.helperRole ?? preset.helperRole,
    roleId,
    deploymentProfile: 'einsatz',
    uiVariant: tuning.uiVariant ?? preset.uiVariant,
    transportProfile: tuning.transportProfile ?? preset.transportProfile,
    simpleMode: tuning.simpleMode ?? preset.simpleMode,
    omitTeamMailboxes: tuning.omitTeamMailboxes === true,
  }
}

/** Gespeicherte Einsatz-Vorlage → Basis-Karte + Tuning (Legacy + Snapshot Phase 4). */
export function handoffParamsFromEinsatzTemplate(t: EinsatzRoleTemplate): {
  presetId: HandoffEinsatzPresetId
  tuning: HandoffExportTuning
  label: string
} {
  if (t.handoffSnapshot) {
    const snap = t.handoffSnapshot
    const tuning: HandoffExportTuning = {}
    if (snap.tuning?.roleId != null) tuning.roleId = snap.tuning.roleId
    else tuning.roleId = t.roleId
    if (snap.tuning?.helperRole) tuning.helperRole = snap.tuning.helperRole
    if (snap.tuning?.simpleMode === true) tuning.simpleMode = true
    if (snap.tuning?.simpleMode === false) tuning.simpleMode = false
    if (snap.tuning?.omitTeamMailboxes) tuning.omitTeamMailboxes = true
    return {
      presetId: snap.presetId,
      tuning,
      label: snap.bezeichnungHint?.trim() || t.label,
    }
  }
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

/** ROLE_ID nur Empfangen (L-Bit) — Reporter-Vorschlag. */
export const HANDOFF_ROLE_ID_LISTEN_ONLY = 4

export { describeRoleIdBits } from '@/frontend/lib/handoff-role-id-bits'
