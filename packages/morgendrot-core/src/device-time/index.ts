export {
  type DeviceTimeTrustLevel,
  type StatusPollClockHint,
  STATUS_POLL_CLOCK_MAX_AGE_MS,
  isPlausibleHttpDateUtcMs,
  isFreshPollClock,
  hadRecentPlausibleServerTimeFromPoll,
  type DeviceTimeTrustSignals,
  inferDeviceTimeTrust,
  shouldWarnUntrustedDeviceTime,
} from './device-time-trust'
