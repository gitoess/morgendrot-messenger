import { describe, expect, it } from 'vitest'
import { buildInitialProfileFromDirectory } from './initial-profile-export'

describe('buildInitialProfileFromDirectory', () => {
  it('mappt Telefonbuch auf initialProfile v1', () => {
    const addr = '0x' + 'a'.repeat(64)
    const profile = buildInitialProfileFromDirectory({
      [addr]: { label: 'Alpha', roleTags: ['Medic'] },
    })
    expect(profile.version).toBe(1)
    expect(profile.contacts).toEqual([{ name: 'Alpha', address: addr, roleTags: ['Medic'] }])
  })
})
