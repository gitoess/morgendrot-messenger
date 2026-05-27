/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { buildHandoffZipWire, parseHandoffZipWire } from '@/frontend/lib/handoff-iota-wire'

describe('handoff-iota-wire', () => {
  it('roundtrip zip bytes in wire', () => {
    const zip = new Uint8Array([80, 75, 3, 4])
    const wire = buildHandoffZipWire(zip, {
      label: 'Test',
      protected: true,
      exportedAt: '2026-05-20T12:00:00.000Z',
    })
    const parsed = parseHandoffZipWire(wire)
    expect(parsed).not.toBeNull()
    expect(parsed!.zipBytes).toEqual(zip)
    expect(parsed!.meta.label).toBe('Test')
    expect(parsed!.meta.protected).toBe(true)
  })
})
