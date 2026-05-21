/**
 * Kanonische Übersicht: Kanäle (1:1 / Gruppe / Pinnwand) × Persistenz × Mailbox-Ziel.
 * @see docs/SENDEWEGE-KANAL-MAILBOX-UEBERSICHT.md
 */

export type SendPathOverviewRow = {
  id: string
  typeLabel: string
  uiName: string
  channel: string
  persistence: string
  encryption: string
  whoSees: string
  whenUse: string
  activeRequired: string
  badge?: 'server' | 'team' | 'private' | 'event' | 'channel'
}

/** Reihenfolge: Kanäle zuerst, dann Speicher/Mailbox-Ziele. */
export const SEND_PATH_OVERVIEW_ROWS: SendPathOverviewRow[] = [
  {
    id: 'channel-private',
    typeLabel: 'Kanal',
    uiName: '1:1 Privat',
    channel: '1:1',
    persistence: 'Event oder Mailbox (Umschalter „Speicher auf der Chain“)',
    encryption: 'Ja / Nein (Schloss oben; verschlüsselt braucht Handshake)',
    whoSees: 'Nur Gesprächspartner (0x-Adresse)',
    whenUse: 'Direkte Absprachen, vertrauliche 1:1-Kommunikation',
    activeRequired: 'Nein (Kanalwahl)',
    badge: 'channel',
  },
  {
    id: 'channel-group',
    typeLabel: 'Kanal',
    uiName: 'Gruppenchat',
    channel: 'Gruppe (Filter)',
    persistence: 'Wie 1:1: Event oder Mailbox (Einstellung bleibt gespeichert)',
    encryption: 'Ja / Nein — Senden weiter an **eine** Empfänger-0x (pairwise)',
    whoSees: 'Posteingang zeigt Union aller Gruppenmitglieder; kein gemeinsamer Chain-Raum',
    whenUse: 'Kleine Einsatzgruppe (5–20), gemeinsamer Überblick im Posteingang',
    activeRequired: 'Nein — Gruppe in „Gruppenchat“-Panel wählen',
    badge: 'channel',
  },
  {
    id: 'channel-pinnwand',
    typeLabel: 'Kanal',
    uiName: 'Pinnwand',
    channel: 'Broadcast (Brett)',
    persistence: 'Meist Klartext (Event oder Mailbox an Broadcast-Adresse)',
    encryption: 'UI: Klartext; online verschlüsselt nur im privaten 1:1-Kanal sinnvoll',
    whoSees: 'Alle mit gleicher PACKAGE_ID + Posteingang; Schreiben nur autorisierte 0x',
    whenUse: 'Lagebild, Bekanntmachungen, Befehle an alle',
    activeRequired: 'Nein — Empfänger = Broadcast-Adresse aus Server-.env',
    badge: 'channel',
  },
  {
    id: 'event',
    typeLabel: 'Speicher',
    uiName: 'Flüchtig (Event)',
    channel: '1:1 (online)',
    persistence: 'Nein — Chain-Event, kein Mailbox-Eintrag',
    encryption: 'Ja / Nein',
    whoSees: 'Empfänger-Adresse (Events im Paket)',
    whenUse: 'Schnelle Absprachen ohne Mailbox-Rebate-Pfad',
    activeRequired: 'Nein',
    badge: 'event',
  },
  {
    id: 'server-shared',
    typeLabel: 'Mailbox',
    uiName: 'Server · Einsatz (Shared)',
    channel: '1:1 im gemeinsamen Postamt',
    persistence: 'Ja (Mailbox)',
    encryption: 'Ja / Nein',
    whoSees: 'Alle Nutzer dieses Servers (gleiche MAILBOX_ID / .env)',
    whenUse: 'Standard-Einsatz, klassisches Team auf einem Knoten',
    activeRequired: 'Nein — **immer** im Posteingang',
    badge: 'server',
  },
  {
    id: 'team',
    typeLabel: 'Mailbox',
    uiName: 'Team-Mailbox',
    channel: '1:1 im Team-Postfach',
    persistence: 'Ja (Mailbox)',
    encryption: 'Ja / Nein',
    whoSees: 'Wer die Object-ID kennt (kein On-Chain-Mitgliedschaftsmodell)',
    whenUse: 'THW, Feuerwehr, Stab — parallele Organisationen',
    activeRequired: 'Ja — unter „Meine Mailboxen“ aktiv setzen',
    badge: 'team',
  },
  {
    id: 'private',
    typeLabel: 'Mailbox',
    uiName: 'Eigene Private Mailbox',
    channel: '1:1',
    persistence: 'Ja (Mailbox)',
    encryption: 'Ja / Nein',
    whoSees: 'Nur Owner der PrivateMailbox + Kontakte mit deiner Mailbox-ID',
    whenUse: 'Persönliches Postfach, sensible 1:1, getrennt vom Einsatz-Postamt',
    activeRequired: 'Ja — unter „Meine Mailboxen“ aktiv setzen',
    badge: 'private',
  },
]

/** Kurz-Matrix: was gilt beim Senden (online, Persistent)? */
export const SEND_TARGET_PRIORITY_HINT =
  'Senden (Persistent): Kontakt-Mailbox im Telefonbuch → aktiv gesetzte Team- oder Private-Mailbox → Server-MAILBOX_ID.'

export const INBOX_UNION_HINT =
  'Posteingang: immer Server-Shared (.env) + optional die **aktive** Team- oder Private-Mailbox (nicht alle Team-Listen auf einmal).'
