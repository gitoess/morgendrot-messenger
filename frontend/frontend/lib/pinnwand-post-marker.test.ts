import { describe, expect, it } from 'vitest'
import {
  hasPinnwandPostMarker,
  prependPinnwandPostMarker,
  stripPinnwandPostMarker,
} from '@/frontend/lib/pinnwand-post-marker'

describe('pinnwand-post-marker', () => {
  it('erkennt und setzt Marker', () => {
    const marked = prependPinnwandPostMarker('Update')
    expect(hasPinnwandPostMarker(marked)).toBe(true)
    expect(stripPinnwandPostMarker(marked)).toBe('Update')
  })

  it('doppeltes Setzen ist idempotent', () => {
    const once = prependPinnwandPostMarker('A')
    expect(prependPinnwandPostMarker(once)).toBe(once)
  })
})
