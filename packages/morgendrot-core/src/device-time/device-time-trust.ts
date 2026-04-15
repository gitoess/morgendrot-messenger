/**
 * Konservatives Vertrauensmodell für **UTC auf dem Gerät** (Cold-Start, Funkloch).
 * Keine Netzwerkaufrufe — nur Signale aus der App einreichen.
 *
 * Fahrplan: **`docs/ROADMAP-FAHRPLAN.md`** § **H.6c**; Sync: **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** §6.
 * Kanonische Quelle: **`@morgendrot/core`** — `src/shared` und PWA re-exportieren.
 */

export type DeviceTimeTrustLevel = 'high' | 'medium' | 'low'

/** Erfolgreicher GET /api/status mit optionalem HTTP-`Date`-Header (UTC). */
export type StatusPollClockHint = {
  okAtMs: number
  /** `Date.parse` des Response-`Date`-Headers, sonst `null`. */
  httpDateUtcMs: number | null
}

/** Max. Alter des letzten Status-Polls, ab dem die Referenz verworfen wird (15 min). */
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

/** `true`, wenn frischer Poll **und** plausibles HTTP-Datum — dann `hadRecentPlausibleServerOrChainTime`. */
export function hadRecentPlausibleServerTimeFromPoll(
  hint: StatusPollClockHint | null,
  nowMs: number
): boolean {
  if (!hint || !isFreshPollClock(hint, nowMs)) return false
  if (hint.httpDateUtcMs == null) return false
  return isPlausibleHttpDateUtcMs(hint.httpDateUtcMs)
}

export type DeviceTimeTrustSignals = {
  /** Entspricht typ. `navigator.onLine`. */
  navigatorOnline: boolean
  /**
   * Letzte erfolgreiche Abfrage lieferte **plausible** Referenzzeit (z. B. Server-Date-Header,
   * Chain-/Indexer-Timestamp im Fenster) — **explizit** setzen, nicht raten.
   */
  hadRecentPlausibleServerOrChainTime?: boolean
  /**
   * GPS-Fix lieferte **UTC** aus Satelliten (nicht nur Koordinaten ohne Zeit).
   * Offline im Gelände oft die **einzige** zuverlässige Quelle.
   */
  hasTrustedGpsUtcFix?: boolean
}

/**
 * Priorität: verifizierbare Quellen vor heuristischem „online = wahrscheinlich ok“.
 *
 * - **high:** explizite Server-/Chain-Zeit **oder** vertrauenswürdiger GPS-UTC-Fix.
 * - **medium:** nur „Browser meldet online“ — Uhr kann trotzdem falsch sein (manuell gestellt).
 * - **low:** offline **und** kein GPS-UTC — Attestation/Export nur mit Warnung.
 */
export function inferDeviceTimeTrust(s: DeviceTimeTrustSignals): DeviceTimeTrustLevel {
  if (s.hadRecentPlausibleServerOrChainTime === true || s.hasTrustedGpsUtcFix === true) {
    return 'high'
  }
  if (s.navigatorOnline) {
    return 'medium'
  }
  return 'low'
}

/** Ob UI vor **forensischen** oder **Chain-stempelnden** Aktionen explizit warnen soll. */
export function shouldWarnUntrustedDeviceTime(level: DeviceTimeTrustLevel): boolean {
  return level !== 'high'
}
