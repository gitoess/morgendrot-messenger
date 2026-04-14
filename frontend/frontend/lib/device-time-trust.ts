'use client'

/**
 * Browser: gleiche Logik wie `src/shared/device-time-trust.ts` (Next/Turbopack lädt kein `../src/shared`).
 */

export type DeviceTimeTrustLevel = 'high' | 'medium' | 'low'

export type StatusPollClockHint = {
  okAtMs: number
  httpDateUtcMs: number | null
}

export const STATUS_POLL_CLOCK_MAX_AGE_MS = 15 * 60 * 1000

export function isPlausibleHttpDateUtcMs(ms: number): boolean {
  if (!Number.isFinite(ms) || ms <= 0) return false
  const y = new Date(ms).getUTCFullYear()
  return y >= 2024 && y <= 2037
}

export function isFreshPollClock(hint: StatusPollClockHint, nowMs: number): boolean {
  const age = nowMs - hint.okAtMs
  return age >= 0 && age <= STATUS_POLL_CLOCK_MAX_AGE_MS
}

export function hadRecentPlausibleServerTimeFromPoll(
  hint: StatusPollClockHint | null,
  nowMs: number
): boolean {
  if (!hint || !isFreshPollClock(hint, nowMs)) return false
  if (hint.httpDateUtcMs == null) return false
  return isPlausibleHttpDateUtcMs(hint.httpDateUtcMs)
}

export type DeviceTimeTrustSignals = {
  navigatorOnline: boolean
  hadRecentPlausibleServerOrChainTime?: boolean
  hasTrustedGpsUtcFix?: boolean
}

export function inferDeviceTimeTrust(s: DeviceTimeTrustSignals): DeviceTimeTrustLevel {
  if (s.hadRecentPlausibleServerOrChainTime === true || s.hasTrustedGpsUtcFix === true) {
    return 'high'
  }
  if (s.navigatorOnline) {
    return 'medium'
  }
  return 'low'
}

export function shouldWarnUntrustedDeviceTime(level: DeviceTimeTrustLevel): boolean {
  return level !== 'high'
}
