import type { ClockPort } from './clock'

/** Produktion: `Date.now()` (Browser, Node, CM4). */
export function createSystemClock(): ClockPort {
  return { now: () => Date.now() }
}

/**
 * Tests / deterministische Szenarien. `setNow` setzt den Rückgabewert von `now()`.
 */
export function createFixedClock(initialMs: number): ClockPort & { setNow(ms: number): void } {
  let t = initialMs
  return {
    now: () => t,
    setNow(ms: number) {
      t = ms
    },
  }
}
