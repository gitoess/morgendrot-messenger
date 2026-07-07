'use client'

/**
 * § H.15 Phase 2 — nutzerlesbare Fehler für Direkt-RPC-Submit (Klartext + verschlüsselt).
 */

/** Zusammenführung wenn Direct fehlschlägt und Relay/API nachgezogen wird. */
export function mergeDirectThenRelayErrors(directErr: string | undefined, relayErr: string | undefined): string {
  const d = (directErr || '').trim()
  const r = (relayErr || '').trim()
  if (d && r) return `Direkt-RPC: ${d} — Relay/API: ${r}`
  return r || d || 'Senden fehlgeschlagen'
}

export function formatDirectIotaSubmitError(reason: unknown): string {
  const raw =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : String(reason ?? 'Unbekannter Fehler')
  const m = raw.trim()
  if (!m) return 'Unbekannter Fehler beim Direkt-Submit'
  const lower = m.toLowerCase()

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed')
  ) {
    return 'Fullnode nicht erreichbar (Netzwerk, CORS oder falsche URL). In den Einstellungen „Erreichbarkeit prüfen“ und RPC-URL prüfen — bei APK die PC-LAN-Adresse, nicht 127.0.0.1.'
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout')) {
    return 'Fullnode-Zeitüberschreitung — RPC-URL oder Netz prüfen, später erneut versuchen.'
  }
  if (lower.includes('cors') || lower.includes('cross-origin')) {
    return 'Browser blockiert den RPC-Zugriff (CORS). Andere Fullnode-URL wählen oder Relay-Modus nutzen.'
  }
  if (lower.includes('insufficient') && (lower.includes('gas') || lower.includes('balance'))) {
    return 'Nicht genug IOTA für Gas auf dem Signer-Konto — Wallet aufladen oder Sponsored-Gas über Relay.'
  }
  if (lower.includes('429') || lower.includes('rate limit')) {
    return 'Fullnode limitiert Anfragen (Rate-Limit) — kurz warten oder andere RPC-URL.'
  }
  if (lower.includes('invalid signature') || lower.includes('signature verification')) {
    return 'Signatur von der Kette abgelehnt — Signer/Mnemonic und Absender-Adresse (MY_ADDRESS) abgleichen.'
  }
  if (lower.includes('objectnotfound') || lower.includes('object not found')) {
    return 'Mailbox- oder Package-Objekt auf der Kette nicht gefunden — Ketten-IDs aus der Basis aktualisieren.'
  }
  if (lower.includes('package object does not exist') || lower.includes('dependent package not found')) {
    return (
      'Package existiert auf diesem Netz nicht — Testnet- und Mainnet-IDs vermischt oder falsches Netzwerk aktiv. ' +
      'Einstellungen → Netzwerk: pro Profil (Testnet/Mainnet) eigene Package-ID + Mailbox-ID + passende RPC-URL.'
    )
  }
  if (
    lower.includes('invalid command argument') &&
    (lower.includes('type of the value') || lower.includes('does not match the expected type'))
  ) {
    return (
      'Mailbox-Typ passt nicht zur Move-Funktion (oft: Postfach von altem Package nach Move-Deploy). ' +
      'Neues Team-Postfach anlegen oder create_globals + MAILBOX_ID aktualisieren, dann in der Gruppe verknüpfen.'
    )
  }
  if (lower.includes('e_not_owner') || (lower.includes('not owner') && lower.includes('assert'))) {
    return 'Purge nicht erlaubt — bei Team-Broadcast nur der Original-Sender vor Ablauf der TTL; danach jeder.'
  }
  if (lower.includes('locked') && lower.includes('object')) {
    return 'Objekt auf der Kette gesperrt — Mailbox-Version/Deploy prüfen.'
  }
  if (lower.includes('user rejected') || lower.includes('denied')) {
    return 'Signatur abgebrochen oder abgelehnt.'
  }

  return m.length > 280 ? `${m.slice(0, 277)}…` : m
}
