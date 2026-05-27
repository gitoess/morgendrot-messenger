import {
  HANDOFF_EINSATZ_PRESETS,
  normalizeHandoffExportPresetId,
  type HandoffEinsatzPresetId,
} from '@/frontend/lib/handoff-export-presets'

const LS_HANDOFF_LAST_PRESET = 'morgendrot.handoff.lastPreset'

export function readHandoffLastPresetId(): HandoffEinsatzPresetId | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_HANDOFF_LAST_PRESET)?.trim()
    if (!raw) return null
    return normalizeHandoffExportPresetId(raw)
  } catch {
    return null
  }
}

export function writeHandoffLastPresetId(id: HandoffEinsatzPresetId): void {
  if (typeof window === 'undefined') return
  if (!HANDOFF_EINSATZ_PRESETS.some((p) => p.id === id)) return
  try {
    window.localStorage.setItem(LS_HANDOFF_LAST_PRESET, id)
  } catch {
    /* ignore quota */
  }
}
