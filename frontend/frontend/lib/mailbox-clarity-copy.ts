/**
 * Kurze Nutzer-Texte für Meine Mailboxen — Details im Handbuch.
 * @see docs/MAILBOX-BEGRIFFE-UND-NUTZUNG.md
 */

export function mainMailboxTitle(): string {
  return 'Hauptpostfach'
}

export function mainMailboxSubtitle(): string {
  return 'Immer im Posteingang'
}

export function mainMailboxExplain(): string {
  return 'Shared/Einsatz-Postfach (MAILBOX_ID) — nicht deine private Object-ID.'
}

export function teamMailboxesExplain(createAllowed: boolean): string {
  return createAllowed
    ? 'Team-Broadcast: alle mit derselben Postfach-ID. Anlegen oder ID einfügen.'
    : 'Team-Broadcast: Postfach-ID einfügen oder beitreten (Anlegen ggf. gesperrt).'
}

export function privateMailboxesExplain(): string {
  return 'Persönliches Postfach — Partner brauchen die Object-ID (Visitenkarte/QR).'
}

export function myMailboxesSettingsBlurb(): string {
  return 'Haupt = Shared. Privat/Team = eigene Object-IDs. Handbuch: Mailbox-Begriffe.'
}
