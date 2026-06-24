import { beforeEach, describe, expect, it } from 'vitest'
import {
  enqueueRosterPendingSuggestion,
  listRosterPendingSuggestions,
  removeRosterPendingSuggestion,
} from './team-roster-pending-store'

const ADDR = '0x' + 'c'.repeat(64)

describe('team-roster-pending-store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('legt Handoff-Vorschlag an und entfernt ihn', () => {
    const s = enqueueRosterPendingSuggestion({
      source: 'handoff',
      member: { address: ADDR, name: 'Helfer 1' },
      registryEntryId: 'e1',
    })
    expect(listRosterPendingSuggestions()).toHaveLength(1)
    expect(listRosterPendingSuggestions()[0].id).toBe(s.id)
    removeRosterPendingSuggestion(s.id)
    expect(listRosterPendingSuggestions()).toHaveLength(0)
  })

  it('aktualisiert bestehenden Eintrag pro Adresse', () => {
    enqueueRosterPendingSuggestion({
      source: 'handoff',
      member: { address: ADDR, name: 'Alt' },
    })
    enqueueRosterPendingSuggestion({
      source: 'handoff',
      member: { address: ADDR, name: 'Neu' },
    })
    expect(listRosterPendingSuggestions()).toHaveLength(1)
    expect(listRosterPendingSuggestions()[0].member.name).toBe('Neu')
  })
})
