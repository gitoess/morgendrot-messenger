import { describe, expect, it } from 'vitest'
import {
  formatDirectIotaSubmitError,
  mergeDirectThenRelayErrors,
} from './direct-iota-error-messages'

describe('direct-iota-error-messages (H.15 Phase 2)', () => {
  it('mergeDirectThenRelayErrors kombiniert beide Pfade', () => {
    expect(mergeDirectThenRelayErrors('RPC down', 'Basis offline')).toBe(
      'Direkt-RPC: RPC down — Relay/API: Basis offline'
    )
    expect(mergeDirectThenRelayErrors('', 'nur relay')).toBe('nur relay')
  })

  it('formatDirectIotaSubmitError erkennt Netzwerk/CORS', () => {
    expect(formatDirectIotaSubmitError(new Error('Failed to fetch'))).toMatch(/Fullnode nicht erreichbar/)
    expect(formatDirectIotaSubmitError('CORS policy blocked')).toMatch(/CORS/)
  })

  it('formatDirectIotaSubmitError erkennt Gas und Timeout', () => {
    expect(formatDirectIotaSubmitError('insufficient gas balance')).toMatch(/Gas/)
    expect(formatDirectIotaSubmitError('request timed out')).toMatch(/Zeitüberschreitung/)
  })

  it('behält unbekannte Meldungen gekürzt', () => {
    const long = 'x'.repeat(400)
    const out = formatDirectIotaSubmitError(long)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(280)
  })
})
