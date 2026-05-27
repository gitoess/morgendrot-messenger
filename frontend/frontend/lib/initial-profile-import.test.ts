import { describe, it, expect, beforeEach } from 'vitest'
import {
  extractInitialProfileFromPaste,
  fingerprintInitialProfile,
  summarizeInitialProfile,
  queueInitialProfileForNextApply,
  clearPendingInitialProfile,
  LS_OFFLINE_BRIEFING_DISPLAY,
  persistOfflineBriefingFromProfile,
} from './initial-profile-import'

describe('extractInitialProfileFromPaste', () => {
  it('liest initialProfile aus jsonConfig', () => {
    const raw = JSON.stringify({
      role: 'arbeiter',
      initialProfile: { version: 1, contacts: [{ name: 'A', address: '0x' + 'a'.repeat(64) }] },
    })
    const p = extractInitialProfileFromPaste(raw)
    expect(p).not.toBeNull()
    expect(p?.version).toBe(1)
    expect(Array.isArray(p?.contacts)).toBe(true)
    expect((p?.contacts as { name: string }[])[0]?.name).toBe('A')
  })

  it('akzeptiert Root initialProfile-Objekt', () => {
    const raw = JSON.stringify({
      version: 1,
      contacts: [{ name: 'B', address: '0x' + 'b'.repeat(64), roleTags: ['Medic'] }],
    })
    const p = extractInitialProfileFromPaste(raw)
    expect(p?.contacts).toHaveLength(1)
    expect((p?.contacts as { roleTags?: string[] }[])[0]?.roleTags).toEqual(['Medic'])
  })

  it('lehnt ungültiges JSON ab', () => {
    expect(extractInitialProfileFromPaste('not json')).toBeNull()
    expect(extractInitialProfileFromPaste('[]')).toBeNull()
    expect(extractInitialProfileFromPaste('{"version":2}')).toBeNull()
  })
})

describe('fingerprintInitialProfile', () => {
  it('ist stabil bei Permutation der Kontakt-Reihenfolge', () => {
    const a = {
      version: 1,
      contacts: [
        { name: 'X', address: '0x' + 'c'.repeat(64), roleTags: ['b', 'a'] },
        { name: 'Y', address: '0x' + 'd'.repeat(64) },
      ],
    }
    const b = {
      version: 1,
      contacts: [
        { name: 'Y', address: '0x' + 'd'.repeat(64) },
        { name: 'X', address: '0x' + 'c'.repeat(64), roleTags: ['a', 'b'] },
      ],
    }
    expect(fingerprintInitialProfile(a)).toBe(fingerprintInitialProfile(b))
  })
})

describe('summarizeInitialProfile', () => {
  it('zählt Kontakte und Kanal', () => {
    const s = summarizeInitialProfile({
      version: 1,
      deploymentChannelTag: 'Sektor-Nord',
      contacts: [
        { name: 'Anna', address: '0x' + 'a'.repeat(64) },
        { name: 'Bob', address: '0x' + 'b'.repeat(64) },
      ],
    })
    expect(s.contactCount).toBe(2)
    expect(s.deploymentChannelTag).toBe('Sektor-Nord')
    expect(s.contactPreview[0]).toContain('Anna')
  })
})

describe('localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('queueInitialProfileForNextApply und clearPendingInitialProfile', () => {
    const p = { version: 1, contacts: [] }
    queueInitialProfileForNextApply(p)
    expect(localStorage.getItem('morgendrot.pendingInitialProfileJson')).toContain('"version":1')
    clearPendingInitialProfile()
    expect(localStorage.getItem('morgendrot.pendingInitialProfileJson')).toBeNull()
  })

  it('persistOfflineBriefingFromProfile', () => {
    persistOfflineBriefingFromProfile({ offlineBriefing: '  Funkabbruch: Kanal 3  ' })
    expect(localStorage.getItem(LS_OFFLINE_BRIEFING_DISPLAY)).toBe('Funkabbruch: Kanal 3')
  })
})
