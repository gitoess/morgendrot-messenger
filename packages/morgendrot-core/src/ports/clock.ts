/**
 * Zeitquelle — injizierbar (Browser: `Date.now`, Tests: Fake).
 * Offline-Mailbox-State erhält `now` derzeit als Parameter; dieser Port ist für spätere Orchestratoren.
 */
export type ClockPort = {
  now(): number
}
