import { describe, expect, it } from 'vitest'
import { MORG_PATH4_SELF_ARCHIVE_V1, prependPath4SelfArchiveMarker } from './mesh-path4-self-archive'

describe('mesh-path4-self-archive', () => {
  it('setzt Marker genau einmal voran', () => {
    const t = 'Hallo Funk'
    const w = prependPath4SelfArchiveMarker(t)
    expect(w.startsWith(MORG_PATH4_SELF_ARCHIVE_V1)).toBe(true)
    expect(w).toContain('Hallo Funk')
    expect(prependPath4SelfArchiveMarker(w)).toBe(w)
  })
})
