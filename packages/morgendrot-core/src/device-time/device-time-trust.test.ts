import { describe, it, expect } from 'vitest'
import {
  inferDeviceTimeTrust,
  shouldWarnUntrustedDeviceTime,
  isPlausibleHttpDateUtcMs,
  hadRecentPlausibleServerTimeFromPoll,
  STATUS_POLL_CLOCK_MAX_AGE_MS,
} from './device-time-trust'

describe('device-time-trust (core)', () => {
  it('inferDeviceTimeTrust Stufen', () => {
    expect(
      inferDeviceTimeTrust({
        navigatorOnline: false,
        hadRecentPlausibleServerOrChainTime: true,
      })
    ).toBe('high')
    expect(inferDeviceTimeTrust({ navigatorOnline: false, hasTrustedGpsUtcFix: true })).toBe('high')
    expect(inferDeviceTimeTrust({ navigatorOnline: true })).toBe('medium')
    expect(inferDeviceTimeTrust({ navigatorOnline: false })).toBe('low')
  })

  it('shouldWarnUntrustedDeviceTime', () => {
    expect(shouldWarnUntrustedDeviceTime('high')).toBe(false)
    expect(shouldWarnUntrustedDeviceTime('medium')).toBe(true)
    expect(shouldWarnUntrustedDeviceTime('low')).toBe(true)
  })

  it('hadRecentPlausibleServerTimeFromPoll', () => {
    const now = 1_000_000_000_000
    expect(
      isPlausibleHttpDateUtcMs(Date.parse('Thu, 01 Jan 2026 12:00:00 GMT')) === true
    ).toBe(true)
    expect(isPlausibleHttpDateUtcMs(Date.parse('Thu, 01 Jan 2010 12:00:00 GMT')) === false).toBe(true)
    expect(
      hadRecentPlausibleServerTimeFromPoll(
        { okAtMs: now - 60_000, httpDateUtcMs: Date.parse('Wed, 01 Jan 2026 00:00:00 GMT') },
        now
      )
    ).toBe(true)
    expect(
      hadRecentPlausibleServerTimeFromPoll(
        {
          okAtMs: now - STATUS_POLL_CLOCK_MAX_AGE_MS - 1,
          httpDateUtcMs: Date.parse('Wed, 01 Jan 2026 00:00:00 GMT'),
        },
        now
      )
    ).toBe(false)
    expect(hadRecentPlausibleServerTimeFromPoll({ okAtMs: now - 60_000, httpDateUtcMs: null }, now)).toBe(false)
  })
})
