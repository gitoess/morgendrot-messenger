/**
 * Meshtastic `mesh.proto` → `Routing.Error` (numerische Codes von Firmware/SDK).
 * @see https://github.com/meshtastic/protobufs/blob/master/meshtastic/mesh.proto
 */
export function describeMeshtasticRoutingError(code: number): string {
  switch (code) {
    case 0:
      return 'Kein Fehler (NONE).'
    case 1:
      return 'Keine Route zum Ziel (NO_ROUTE) — Ziel offline oder außer Reichweite.'
    case 2:
      return 'NAK beim Weiterleiten (GOT_NAK).'
    case 3:
      return 'Zeitüberschreitung (TIMEOUT) — oft bei Broadcast/Klartext, wenn kein Mesh-ACK erwartet wird; die Nachricht kann trotzdem ausgesendet worden sein. Zweites Gerät prüfen, SF/LongFast, ggf. erneut senden.'
    case 4:
      return 'Kein passendes Interface (NO_INTERFACE).'
    case 5:
      return 'Max. Wiederholungen (MAX_RETRANSMIT) — Kanal stark belastet oder kein Echo.'
    case 6:
      return 'Kein Kanal (NO_CHANNEL) — gewünschter Kanalindex deaktiviert oder nicht konfiguriert.'
    case 7:
      return 'Paket zu groß (TOO_LARGE) — nach MTU-Kodierung; Text kürzen oder weniger Mesh-v2-Fragmente.'
    case 8:
      return 'Keine Antwort (NO_RESPONSE) — Ziel hat den Dienst nicht oder Berechtigung/Kanal passt nicht.'
    case 9:
      return 'Sende-Pause / Duty-Cycle (DUTY_CYCLE_LIMIT) — kurz warten und erneut versuchen.'
    case 32:
      return 'Ungültige Anfrage (BAD_REQUEST).'
    case 33:
      return 'Nicht autorisiert (NOT_AUTHORIZED) — falscher Kanal / PKI.'
    case 34:
      return 'PKI-Versand fehlgeschlagen (PKI_FAILED).'
    case 35:
      return 'Unbekannter öffentlicher Schlüssel (PKI_UNKNOWN_PUBKEY).'
    case 36:
      return 'Admin: ungültige/abgelaufene Session (ADMIN_BAD_SESSION_KEY).'
    case 37:
      return 'Admin: Schlüssel nicht auf Admin-Liste (ADMIN_PUBLIC_KEY_UNAUTHORIZED).'
    default:
      return `Routing-Fehler-Code ${code} (Meshtastic mesh.proto / ggf. neuere Firmware).`
  }
}

/** Kurzer nächster Schritt für die Statuszeile (nur bei harten Routing-Fehlern). */
export function meshtasticRoutingActionHint(code: number): string {
  switch (code) {
    case 1:
      return 'Ziel eingeschaltet? Gleicher Kanal/Region (z. B. LongFast) und Reichweite prüfen.'
    case 2:
      return 'NAK auf dem Pfad — später erneut versuchen oder anderen Weg/Knoten nutzen.'
    case 4:
      return 'Web Bluetooth: Gerät trennen und neu koppeln; Browser/Firmware prüfen.'
    case 5:
      return 'Mesh stark belastet oder kein Echo — kurz warten, SF/Datenrate prüfen, Text kürzen.'
    case 6:
      return 'Meshtastic-App: primärer Kanal aktiv, PSK und Name wie im Mesh; keinen Kanal deaktiviert lassen.'
    case 7:
      return 'Nachricht kürzen; Foto per Funk nur als LoRa-Zweiteiler (LUMA+CHROMA) oder per „online“; Sprachmemo verkürzen.'
    case 8:
      return 'Ziel unterstützt den Dienst/Port nicht oder Kanal-Berechtigung — Empfänger-App/Firmware prüfen.'
    case 9:
      return 'Duty-Cycle / Sendepause — einige Minuten warten, dann erneut senden.'
    case 32:
      return 'Payload-Format und App-/Firmware-Version prüfen.'
    case 33:
    case 34:
    case 35:
      return 'Kanal- und PKI-Einstellungen an Sender und Empfänger angleichen.'
    case 36:
    case 37:
      return 'Admin-Session bzw. Admin-Schlüsselliste prüfen (nur falls Admin-Pakete).'
    default:
      return ''
  }
}

/**
 * Routing-Codes, die beim **Ausgang** oft ohne funktionales Problem vorkommen (Firmware/SDK wartet auf ACK,
 * Broadcast hat keinen Empfänger-ACK) — kein Abbruch des Sende-Flows.
 */
const MESHTASTIC_OUTBOUND_SOFT_ROUTING_ERRORS = new Set([3])

/**
 * Ob ein geworfener Fehler nach `throwIfMeshtasticRoutingFailed` **kurz wiederholt** werden darf
 * (transiente Mesh-Routing-Codes — s. Beschreibungstext mit Klammer-Tag).
 */
export function meshtasticThrownErrorIsRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return /\((NO_ROUTE|MAX_RETRANSMIT|NO_RESPONSE)\)/.test(err.message)
}

/** `sendPacket` / `sendText` liefern manchmal `{ id, error }` statt zu werfen. */
export function throwIfMeshtasticRoutingFailed(result: unknown, context: string): void {
  if (result == null || typeof result !== 'object') return
  const o = result as { error?: unknown }
  if (!('error' in o)) return
  const raw = o.error
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN
  if (!Number.isFinite(n) || n === 0) return
  if (MESHTASTIC_OUTBOUND_SOFT_ROUTING_ERRORS.has(n)) return
  const desc = describeMeshtasticRoutingError(n)
  const tip = meshtasticRoutingActionHint(n)
  throw new Error(tip ? `${context}: ${desc}\n→ ${tip}` : `${context}: ${desc}`)
}
