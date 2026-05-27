/** Einsatz-Handoff: Basis-Karten + Feineinstellung. § docs/HANDOFF-EXPORT-HYBRID.md */

export type HandoffEinsatzPresetId = 'helfer' | 'fuehrer' | 'spezial'

export type HandoffHelperRole = 'messenger' | 'arbeiter' | 'kommandant'

export type HandoffTransportProfile = 'mesh-first' | 'iota-anchored' | 'iota-full'

export type HandoffEinsatzPreset = {
  id: HandoffEinsatzPresetId
  label: string
  hint: string
  defaultBezeichnung: string
  helperRole: HandoffHelperRole
  roleId: number
  deploymentProfile: 'einsatz'
  uiVariant: 'full' | 'messenger'
  transportProfile: HandoffTransportProfile
  simpleMode: boolean
}

/** Drei Basis-Profile — danach Feineinstellung oder gespeicherte Vorlage. */
export const HANDOFF_EINSATZ_PRESETS: HandoffEinsatzPreset[] = [
  {
    id: 'helfer',
    label: 'Helfer',
    hint: 'Standard-Einsatzkraft — Simple, Funk zuerst, Team-Postfach',
    defaultBezeichnung: 'Helfer-Einsatz',
    helperRole: 'messenger',
    roleId: 14,
    deploymentProfile: 'einsatz',
    uiVariant: 'messenger',
    transportProfile: 'mesh-first',
    simpleMode: true,
  },
  {
    id: 'fuehrer',
    label: 'Führer',
    hint: 'Truppführer — mehr UI, Team verwalten (ROLE=kommandant)',
    defaultBezeichnung: 'Fuehrer-Team',
    helperRole: 'kommandant',
    roleId: 14,
    deploymentProfile: 'einsatz',
    uiVariant: 'full',
    transportProfile: 'iota-anchored',
    simpleMode: false,
  },
  {
    id: 'spezial',
    label: 'Spezial',
    hint: 'Reporter, Nur-Lesen, Sonderrollen — ROLE_ID anpassen (Start: nur L=4)',
    defaultBezeichnung: 'Spezial',
    helperRole: 'messenger',
    roleId: 4,
    deploymentProfile: 'einsatz',
    uiVariant: 'messenger',
    transportProfile: 'mesh-first',
    simpleMode: true,
  },
]

const LEGACY_EXPORT_PRESET: Record<string, HandoffEinsatzPresetId | null> = {
  arbeiter: 'helfer',
  kommandant: 'fuehrer',
  feldtest: 'helfer',
  wanderer: null,
  consumer: null,
}

export function normalizeHandoffExportPresetId(raw: string | null | undefined): HandoffEinsatzPresetId | null {
  const id = String(raw || '').trim() as HandoffEinsatzPresetId
  if (HANDOFF_EINSATZ_PRESETS.some((p) => p.id === id)) return id
  const mapped = LEGACY_EXPORT_PRESET[id]
  if (mapped === null) return null
  if (mapped) return mapped
  return null
}

export function getHandoffPreset(id: HandoffEinsatzPresetId): HandoffEinsatzPreset {
  return HANDOFF_EINSATZ_PRESETS.find((p) => p.id === id) ?? HANDOFF_EINSATZ_PRESETS[0]!
}

export function suggestHandoffBezeichnung(preset: HandoffEinsatzPreset, at = new Date()): string {
  const day = at.toISOString().slice(0, 10)
  return `${preset.defaultBezeichnung}-${day}`
}

export function handoffPresetUsesTeamMailboxes(id: HandoffEinsatzPresetId, omitTeam?: boolean): boolean {
  if (omitTeam) return false
  return true
}
