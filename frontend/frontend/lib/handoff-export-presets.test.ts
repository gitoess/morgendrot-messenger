import { describe, expect, it } from 'vitest'
import {
  getHandoffPreset,
  HANDOFF_EINSATZ_PRESETS,
  handoffPresetUsesTeamMailboxes,
  normalizeHandoffExportPresetId,
  suggestHandoffBezeichnung,
} from './handoff-export-presets'

describe('handoff-export-presets', () => {
  it('drei Hybrid-Basis-Profile', () => {
    expect(HANDOFF_EINSATZ_PRESETS.map((p) => p.id)).toEqual(['helfer', 'fuehrer', 'spezial'])
  })

  it('Spezial startet mit ROLE_ID 4 (nur L)', () => {
    expect(getHandoffPreset('spezial').roleId).toBe(4)
  })

  it('legacy arbeiter → helfer', () => {
    expect(normalizeHandoffExportPresetId('arbeiter')).toBe('helfer')
  })

  it('omitTeamMailboxes schaltet Team-Auswahl ab', () => {
    expect(handoffPresetUsesTeamMailboxes('helfer', true)).toBe(false)
    expect(handoffPresetUsesTeamMailboxes('helfer', false)).toBe(true)
  })
})
