import { describe, it, expect } from 'vitest'
import {
  MORG_DELAY_MIRROR_V1,
  prependDelayMirrorMarker,
  stripDelayMirrorMarker,
} from './mesh-delayed-upload'

describe('mesh-delayed-upload', () => {
  it('prepend ist idempotent', () => {
    const once = prependDelayMirrorMarker('hello')
    expect(once.startsWith(MORG_DELAY_MIRROR_V1)).toBe(true)
    expect(prependDelayMirrorMarker(once)).toBe(once)
  })

  it('strip erkennt Marker und liefert Body', () => {
    const wired = prependDelayMirrorMarker('hello')
    const r = stripDelayMirrorMarker(wired)
    expect(r.mirrored).toBe(true)
    expect(r.body).toBe('hello')
  })

  it('ohne Marker: mirrored false', () => {
    const r = stripDelayMirrorMarker('plain')
    expect(r.mirrored).toBe(false)
    expect(r.body).toBe('plain')
  })
})
