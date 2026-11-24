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
      return (
        'Zeitüberschreitung (TIMEOUT) — oft kein Mesh-ACK trotz Aussendung (Broadcast/Busy). ' +
        'Zweites Gerät prüfen; Schreibtisch/Bild: MediumFast auf beiden Nodes.'
      )
    case 4:
      return 'Kein passendes Interface (NO_INTERFACE).'
    case 5:
      return (
        'Max. Wiederholungen (MAX_RETRANSMIT) — kein Mesh-ACK nach Retries. ' +
        'Oft LongFast + viele Pakete (Bild) oder Duty-Cycle/Kanal voll.'
      )
    case 6:
      return 'Kein Kanal (NO_CHANNEL) — gewünschter Kanalindex deaktiviert oder nicht konfiguriert.'
    case 7:
      return 'Paket zu groß (TOO_LARGE) — nach MTU-Kodierung; Text kürzen oder weniger Mesh-v2-Fragmente.'
    case 8:
      return 'Keine Antwort (NO_RESPONSE) — Ziel hat den Dienst nicht oder Berechtigung/Kanal passt nicht.'
    case 9:
      return 'Sende-Pause / Duty-Cycle (DUTY_CYCLE_LIMIT) — kurz warten und erneut versuchen.'
    case 38:
      return (
        'Airtime-Rate-Limit (RATE_LIMIT_EXCEEDED) — Firmware drosselt TEXT_MESSAGE-Bursts. ' +
        'Bild: wantAck aus + größere Gaps; kurz warten, S-ARQ holt fehlende Segmente.'
      )
    case 39:
      return 'PKI-Senden fehlgeschlagen — kein Public Key für Ziel (PKI_SEND_FAIL_PUBLIC_KEY).'
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
      return (
        'Kurz warten. Für Schreibtisch/Bild: beide Heltecs auf Modem-Preset MediumFast ' +
        '(Meshtastic-App → LoRa) — gleicher Preset/Kanal. Feld/Reichweite: LongFast belassen.'
      )
    case 6:
      return 'Meshtastic-App: primärer Kanal aktiv, PSK und Name wie im Mesh; keinen Kanal deaktiviert lassen.'
    case 7:
      return 'Nachricht kürzen; Foto per Funk nur als LoRa-Zweiteiler (LUMA+CHROMA) oder per „online“; Sprachmemo verkürzen.'
    case 8:
      return 'Ziel unterstützt den Dienst/Port nicht oder Kanal-Berechtigung — Empfänger-App/Firmware prüfen.'
    case 9:
      return 'Duty-Cycle / Sendepause — einige Minuten warten, dann erneut senden.'
    case 38:
      return (
        'Burst langsamer (größere Pause zwischen Segmenten). MediumFast + wantAck aus für Bild. ' +
        'Kurz warten, dann „Nochmals senden“.'
      )
    case 39:
      return 'Ziel-Public-Key in NodeDB prüfen oder ohne PKI (Kanal-PSK) senden.'
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
 * Soft beim Ausgang: Firmware/SDK-ACK fehlt oft trotz Aussendung (Broadcast / Busy Mesh).
 * 3 = TIMEOUT, 5 = MAX_RETRANSMIT — Bild-Bursts.
 * 38 = RATE_LIMIT_EXCEEDED — Airtime-Fairness; S-ARQ repariert, kein Abbruch der Phase.
 */
const MESHTASTIC_OUTBOUND_SOFT_ROUTING_ERRORS = new Set([3, 5, 38])

/** Numerischer Routing-Code aus SDK-Reject `{ id, error }` oder Error-Text. */
export function meshtasticOutboundErrorCode(err: unknown): number | null {
  if (err != null && typeof err === 'object' && 'error' in err) {
    const raw = (err as { error?: unknown }).error
    if (raw == null) return 3
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    if (typeof raw === 'string') {
      const n = parseInt(raw, 10)
      if (Number.isFinite(n)) return n
      const named = raw.toUpperCase()
      if (named.includes('MAX_RETRANSMIT')) return 5
      if (named.includes('TIMEOUT')) return 3
      if (named.includes('NO_ROUTE')) return 1
      if (named.includes('NO_RESPONSE')) return 8
      if (named.includes('RATE_LIMIT')) return 38
      if (named.includes('DUTY_CYCLE')) return 9
    }
  }
  if (err instanceof Error) {
    if (/\(MAX_RETRANSMIT\)|MAX_RETRANSMIT/i.test(err.message)) return 5
    if (/\(TIMEOUT\)|Zeitüberschreitung/i.test(err.message)) return 3
    if (/\(NO_ROUTE\)/i.test(err.message)) return 1
    if (/\(NO_RESPONSE\)/i.test(err.message)) return 8
    if (/RATE_LIMIT_EXCEEDED|Airtime-Rate-Limit/i.test(err.message)) return 38
    if (/DUTY_CYCLE_LIMIT/i.test(err.message)) return 9
  }
  return null
}

export function isMeshtasticOutboundSoftRoutingError(err: unknown): boolean {
  const c = meshtasticOutboundErrorCode(err)
  return c != null && MESHTASTIC_OUTBOUND_SOFT_ROUTING_ERRORS.has(c)
}

/** SDK rejectet oft mit Plain-Object — immer in Error mit klarem Text wandeln. */
export function normalizeMeshtasticOutboundFailure(err: unknown, context: string): Error {
  const code = meshtasticOutboundErrorCode(err)
  if (code != null) {
    const desc = describeMeshtasticRoutingError(code)
    const tip = meshtasticRoutingActionHint(code)
    return new Error(tip ? `${context}: ${desc}\n→ ${tip}` : `${context}: ${desc}`)
  }
  if (err instanceof Error) {
    const m = (err.message || '').trim()
    if (m && m !== '[object Object]') return err
  }
  if (err == null) return new Error(`${context}: unbekannter Funk-Fehler`)
  if (typeof err === 'string' && err.trim()) return new Error(`${context}: ${err}`)
  if (typeof err === 'object') {
    try {
      const s = JSON.stringify(err)
      if (s && s !== '{}' && s !== 'null') return new Error(`${context}: ${s}`)
    } catch {
      /* ignore */
    }
  }
  return new Error(`${context}: Funk-Fehler (nicht serialisierbar)`)
}

/**
 * Ob ein geworfener Fehler nach `throwIfMeshtasticRoutingFailed` **kurz wiederholt** werden darf
 * (transiente Mesh-Routing-Codes — s. Beschreibungstext mit Klammer-Tag).
 */
export function meshtasticThrownErrorIsRetryable(err: unknown): boolean {
  const c = meshtasticOutboundErrorCode(err)
  if (c === 1 || c === 5 || c === 8 || c === 9 || c === 38) return true
  if (!(err instanceof Error)) return false
  return /\((NO_ROUTE|MAX_RETRANSMIT|NO_RESPONSE|DUTY_CYCLE_LIMIT|RATE_LIMIT_EXCEEDED)\)/.test(
    err.message
  )
}

/** `sendPacket` / `sendText` liefern manchmal `{ id, error }` statt zu werfen. */
export function throwIfMeshtasticRoutingFailed(result: unknown, context: string): void {
  if (result == null || typeof result !== 'object') return
  const o = result as { error?: unknown }
  if (!('error' in o)) return
  const raw = o.error
  if (raw == null) return
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN
  if (!Number.isFinite(n) || n === 0) return
  if (MESHTASTIC_OUTBOUND_SOFT_ROUTING_ERRORS.has(n)) return
  const desc = describeMeshtasticRoutingError(n)
  const tip = meshtasticRoutingActionHint(n)
  throw new Error(tip ? `${context}: ${desc}\n→ ${tip}` : `${context}: ${desc}`)
}
