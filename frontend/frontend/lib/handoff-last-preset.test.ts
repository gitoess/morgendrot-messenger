import { describe, expect, it, beforeEach } from 'vitest'
import { readHandoffLastPresetId, writeHandoffLastPresetId } from './handoff-last-preset'

describe('handoff-last-preset', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('schreibt und liest gültiges Preset', () => {
    writeHandoffLastPresetId('fuehrer')
    expect(readHandoffLastPresetId()).toBe('fuehrer')
  })

  it('mappt legacy feldtest → helfer beim Lesen', () => {
    window.localStorage.setItem('morgendrot.handoff.lastPreset', 'feldtest')
    expect(readHandoffLastPresetId()).toBe('helfer')
  })

  it('ignoriert unbekannte IDs', () => {
    window.localStorage.setItem('morgendrot.handoff.lastPreset', 'unknown')
    expect(readHandoffLastPresetId()).toBeNull()
  })
})
