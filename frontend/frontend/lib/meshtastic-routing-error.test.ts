import { describe, it, expect } from 'vitest'
import { describeMeshtasticRoutingError, throwIfMeshtasticRoutingFailed } from '@/frontend/lib/meshtastic-routing-error'

describe('describeMeshtasticRoutingError', () => {
  it('mappt TIMEOUT (3)', () => {
    expect(describeMeshtasticRoutingError(3)).toMatch(/Zeitüberschreitung/)
  })

  it('mappt TOO_LARGE (7)', () => {
    expect(describeMeshtasticRoutingError(7)).toMatch(/zu groß/)
  })
})

describe('throwIfMeshtasticRoutingFailed', () => {
  it('wirft bei hartem Routing-Fehler inkl. Aktions-Hinweis', () => {
    expect(() => throwIfMeshtasticRoutingFailed({ id: 1, error: 7 }, 'Test')).toThrow(/zu groß/)
    try {
      throwIfMeshtasticRoutingFailed({ id: 1, error: 7 }, 'Test')
    } catch (e) {
      expect(String(e)).toMatch(/→/)
      expect(String(e)).toMatch(/LUMA\+CHROMA|online/)
    }
  })

  it('wirft nicht bei TIMEOUT (3)', () => {
    expect(() => throwIfMeshtasticRoutingFailed({ id: 1, error: 3 }, 'Test')).not.toThrow()
  })

  it('wirft nicht bei NONE / fehlendem error', () => {
    expect(() => throwIfMeshtasticRoutingFailed({ id: 1, error: 0 }, 'Test')).not.toThrow()
    expect(() => throwIfMeshtasticRoutingFailed({}, 'Test')).not.toThrow()
  })
})
