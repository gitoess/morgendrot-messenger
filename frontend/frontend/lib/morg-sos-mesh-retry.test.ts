import { describe, expect, it, vi, afterEach } from 'vitest'
import { sosMeshRetryDelayMs, SOS_MESH_RETRY_DEFAULTS } from '@/frontend/lib/morg-sos-mesh-retry'

describe('morg-sos-mesh-retry (B2)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maxAttempts entspricht Spec B2 (5 Versuche)', () => {
    expect(SOS_MESH_RETRY_DEFAULTS.maxAttempts).toBe(5)
  })

  it('attemptIndex 0: Verzögerung um initialDelayMs bei mittigem Jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(sosMeshRetryDelayMs(0)).toBe(SOS_MESH_RETRY_DEFAULTS.initialDelayMs)
  })

  it('attemptIndex 0: Jitter nach unten (random 0) bleibt ≥ 500 ms', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const d = sosMeshRetryDelayMs(0)
    expect(d).toBeGreaterThanOrEqual(500)
    expect(d).toBeLessThanOrEqual(SOS_MESH_RETRY_DEFAULTS.initialDelayMs)
  })

  it('steigt mit attemptIndex (Exponent, gecappt)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const d0 = sosMeshRetryDelayMs(0)
    const d1 = sosMeshRetryDelayMs(1)
    const d2 = sosMeshRetryDelayMs(2)
    expect(d1).toBeGreaterThan(d0)
    expect(d2).toBeGreaterThan(d1)
    expect(d2).toBeLessThanOrEqual(SOS_MESH_RETRY_DEFAULTS.maxDelayMs + 1)
  })

  it('negativer attemptIndex fällt auf initialDelay zurück', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(sosMeshRetryDelayMs(-1)).toBe(SOS_MESH_RETRY_DEFAULTS.initialDelayMs)
  })
})
