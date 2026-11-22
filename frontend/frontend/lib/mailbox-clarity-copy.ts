/**
 * Kurze Nutzer-Texte für Meine Mailboxen / Persistenz — H.22 Klarheit.
 * Kein Einsatz-Jargon als Pflicht; Deploy-Hauptpostfach = gemeinsames Postamt.
 */

export function mainMailboxTitle(): string {
  return 'Hauptpostfach'
}

export function mainMailboxSubtitle(): string {
  return 'Immer im Posteingang'
}

export function mainMailboxExplain(): string {
  return 'Gemeinsames Postamt dieses Deployments (MAILBOX_ID). Wird automatisch mitgelesen. Schreiben: Ziel im Composer — nicht mit Team- oder Privat-Mailbox verwechseln.'
}

export function teamMailboxesExplain(createAllowed: boolean): string {
  return createAllowed
    ? 'Optionales zweites Shared-Postfach (z. B. Gruppe). Beitreten = Object-ID kennen. Erstellen legt ein neues Objekt on-chain an. Schreiben: Composer-Ziel wählen.'
    : 'Optionales Team-Postfach — per ID/QR beitreten, wenn jemand die Object-ID teilt. Schreiben: Composer-Ziel wählen.'
}

export function privateMailboxesExplain(): string {
  return 'Dein persönliches Postfach (Owner). Partner brauchen deine Private-Object-ID (+ Handshake für Verschlüsselung). Optional — Shared-Hauptpostfach reicht für den Einstieg.'
}

export function myMailboxesSettingsBlurb(): string {
  return 'Postfach = Speicherort on-chain (nicht der Chat-Partner). Lesen: Haupt + bekannte Privat/Team. Schreiben: Composer. Kontakt-IDs: Telefonbuch → Erweitert.'
}
