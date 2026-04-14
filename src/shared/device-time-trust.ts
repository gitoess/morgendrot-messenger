/**
 * Konservatives Vertrauensmodell für **UTC auf dem Gerät** (Cold-Start, Funkloch).
 * Keine Netzwerkaufrufe — nur Signale aus der App einreichen.
 *
 * Fahrplan: **`docs/ROADMAP-FAHRPLAN.md`** § **H.6c**; Sync: **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** §6.
 */

export type DeviceTimeTrustLevel = 'high' | 'medium' | 'low'

/** Signale, die die UI aus `navigator`, letztem API-Response und Geolocation ableitet. */
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
