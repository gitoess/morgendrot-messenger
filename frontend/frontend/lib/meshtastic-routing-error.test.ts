import { describe, it, expect } from 'vitest'
import {
  describeMeshtasticRoutingError,
  isMeshtasticOutboundSoftRoutingError,
  meshtasticOutboundErrorCode,
  meshtasticThrownErrorIsRetryable,
  normalizeMeshtasticOutboundFailure,
  throwIfMeshtasticRoutingFailed,
} from '@/frontend/lib/meshtastic-routing-error'

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

  it('wirft nicht bei TIMEOUT (3), MAX_RETRANSMIT (5), RATE_LIMIT (38)', () => {
    expect(() => throwIfMeshtasticRoutingFailed({ id: 1, error: 3 }, 'Test')).not.toThrow()
    expect(() => throwIfMeshtasticRoutingFailed({ id: 1, error: 5 }, 'Test')).not.toThrow()
    expect(() => throwIfMeshtasticRoutingFailed({ id: 1, error: 38 }, 'Test')).not.toThrow()
  })

  it('wirft nicht bei NONE / fehlendem error', () => {
    expect(() => throwIfMeshtasticRoutingFailed({ id: 1, error: 0 }, 'Test')).not.toThrow()
    expect(() => throwIfMeshtasticRoutingFailed({}, 'Test')).not.toThrow()
  })
})

describe('meshtasticOutboundErrorCode / soft', () => {
  it('mappt SDK-Reject und null-error', () => {
    expect(meshtasticOutboundErrorCode({ id: 1, error: 5 })).toBe(5)
    expect(meshtasticOutboundErrorCode({ id: 1, error: undefined })).toBe(3)
    expect(isMeshtasticOutboundSoftRoutingError({ error: 5 })).toBe(true)
    expect(isMeshtasticOutboundSoftRoutingError({ error: 38 })).toBe(true)
    expect(isMeshtasticOutboundSoftRoutingError({ error: 7 })).toBe(false)
    expect(describeMeshtasticRoutingError(38)).toMatch(/RATE_LIMIT/)
  })

  it('normalizeMeshtasticOutboundFailure', () => {
    const e = normalizeMeshtasticOutboundFailure({ id: 9, error: 5 }, 'Mesh')
    expect(e).toBeInstanceOf(Error)
    expect(e.message).toMatch(/MAX_RETRANSMIT|Wiederholungen/)
  })

  it('normalizeMeshtasticOutboundFailure: kein „[object Object]“', () => {
    const e = normalizeMeshtasticOutboundFailure({ id: 1, foo: 'bar' }, 'Mesh')
    expect(e.message).not.toMatch(/\[object Object\]/)
    expect(e.message).toMatch(/Mesh/)
    const junk = normalizeMeshtasticOutboundFailure(new Error('[object Object]'), 'Mesh')
    expect(junk.message).not.toBe('[object Object]')
  })
})

describe('meshtasticThrownErrorIsRetryable', () => {
  it('true für NO_ROUTE / MAX_RETRANSMIT / NO_RESPONSE / RATE_LIMIT', () => {
    expect(meshtasticThrownErrorIsRetryable({ error: 1 })).toBe(true)
    expect(meshtasticThrownErrorIsRetryable({ error: 5 })).toBe(true)
    expect(meshtasticThrownErrorIsRetryable({ error: 8 })).toBe(true)
    expect(meshtasticThrownErrorIsRetryable({ error: 38 })).toBe(true)
    expect(meshtasticThrownErrorIsRetryable(new Error('x (NO_ROUTE)'))).toBe(true)
  })

  it('false für NO_CHANNEL; TIMEOUT soft aber nicht „retryable“-Tag für 3', () => {
    try {
      throwIfMeshtasticRoutingFailed({ error: 6 }, 'ctx')
    } catch (e) {
      expect(meshtasticThrownErrorIsRetryable(e)).toBe(false)
    }
    expect(meshtasticThrownErrorIsRetryable(new Error('Zeitüberschreitung (TIMEOUT)'))).toBe(false)
  })
})
