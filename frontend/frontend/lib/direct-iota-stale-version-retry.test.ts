import { describe, expect, it, vi } from 'vitest'
import {
  isStaleObjectVersionError,
  withStaleObjectVersionRetry,
} from '@/frontend/lib/direct-iota-stale-version-retry'

describe('isStaleObjectVersionError', () => {
  it('erkennt consumption/current version', () => {
    expect(
      isStaleObjectVersionError(
        'Object ID 0xabc Version 1 Digest xyz is not available for consumption, current version: 2'
      )
    ).toBe(true)
    expect(isStaleObjectVersionError('Objekt-Version veraltet')).toBe(true)
    expect(isStaleObjectVersionError('insufficient gas')).toBe(false)
  })
})

describe('withStaleObjectVersionRetry', () => {
  it('retried bei stale und liefert ok', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: 'is not available for consumption, current version: 2',
      })
      .mockResolvedValueOnce({ ok: true, digest: 'd' })
    const r = await withStaleObjectVersionRetry(run, { attempts: 3, baseDelayMs: 1 })
    expect(r).toEqual({ ok: true, digest: 'd' })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('bricht bei nicht-stale sofort ab', async () => {
    const run = vi.fn().mockResolvedValue({ ok: false, error: 'insufficient gas' })
    const r = await withStaleObjectVersionRetry(run, { attempts: 3, baseDelayMs: 1 })
    expect(r.ok).toBe(false)
    expect(run).toHaveBeenCalledTimes(1)
  })
})
