import { describe, expect, it } from 'vitest'
import {
  buildCanonicalLoopbackRedirectHref,
  shouldRedirectToCanonicalLoopback,
} from '@/frontend/lib/canonical-loopback-host'

describe('canonical-loopback-host', () => {
  it('redirectet 127.0.0.1 und ::1 auf localhost', () => {
    expect(shouldRedirectToCanonicalLoopback({ hostname: '127.0.0.1' })).toBe(true)
    expect(shouldRedirectToCanonicalLoopback({ hostname: '[::1]' })).toBe(true)
    expect(shouldRedirectToCanonicalLoopback({ hostname: 'localhost' })).toBe(false)
    expect(shouldRedirectToCanonicalLoopback({ hostname: '192.168.1.10' })).toBe(false)
  })

  it('respektiert morgKeepHost=1', () => {
    expect(
      shouldRedirectToCanonicalLoopback({ hostname: '127.0.0.1', search: '?morgKeepHost=1' })
    ).toBe(false)
  })

  it('baut Redirect-URL mit Pfad/Query', () => {
    expect(buildCanonicalLoopbackRedirectHref('http://127.0.0.1:3341/handbook?x=1')).toBe(
      'http://localhost:3341/handbook?x=1'
    )
    expect(buildCanonicalLoopbackRedirectHref('http://localhost:3341/')).toBeNull()
  })
})
