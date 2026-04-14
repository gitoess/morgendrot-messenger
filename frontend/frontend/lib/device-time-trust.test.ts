import { describe, it, expect } from 'vitest'
import {
  hadRecentPlausibleServerTimeFromPoll,
  inferDeviceTimeTrust,
  isPlausibleHttpDateUtcMs,
  STATUS_POLL_CLOCK_MAX_AGE_MS,
} from '@/frontend/lib/device-time-trust'

describe('device-time-trust', () => {
  it('inferDeviceTimeTrust: GPS oder Server → high', () => {
    expect(
      inferDeviceTimeTrust({
        navigatorOnline: false,
        hadRecentPlausibleServerOrChainTime: true,
      })
    ).toBe('high')
    expect(
      inferDeviceTimeTrust({ navigatorOnline: false, hasTrustedGpsUtcFix: true })
    ).toBe('high')
  })

  it('hadRecentPlausibleServerTimeFromPoll', () => {
    const now = 2_000_000_000_000
    const okMs = Date.parse('Wed, 01 Jan 2026 00:00:00 GMT')
    expect(
      hadRecentPlausibleServerTimeFromPoll({ okAtMs: now - 30_000, httpDateUtcMs: okMs }, now)
    ).toBe(true)
    expect(
      hadRecentPlausibleServerTimeFromPoll(
        { okAtMs: now - STATUS_POLL_CLOCK_MAX_AGE_MS - 1, httpDateUtcMs: okMs },
        now
      )
    ).toBe(false)
    expect(hadRecentPlausibleServerTimeFromPoll({ okAtMs: now - 30_000, httpDateUtcMs: null }, now)).toBe(
      false
    )
  })

  it('isPlausibleHttpDateUtcMs', () => {
    expect(isPlausibleHttpDateUtcMs(Date.parse('Thu, 01 Jan 2026 12:00:00 GMT'))).toBe(true)
    expect(isPlausibleHttpDateUtcMs(Date.parse('Thu, 01 Jan 2010 12:00:00 GMT'))).toBe(false)
  })
})
