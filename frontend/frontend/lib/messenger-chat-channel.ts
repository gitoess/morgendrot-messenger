/**
 * Kanal in der „Nachrichten“-Kachel (Dashboard → ein Eintrag).
 * @see docs/MESSENGER-KANAL-MAILBOX-MEILENSTEINE.md M2
 */
export type MessengerChatChannel = 'private' | 'group' | 'pinnwand' | 'notes'

export function isNotesChannel(c: MessengerChatChannel): boolean {
  return c === 'notes'
}

export function isPinnwandChannel(c: MessengerChatChannel): boolean {
  return c === 'pinnwand'
}

/** Dialog-Kanäle (1:1 + Gruppe) — nicht Pinnwand/Brett. */
export function isDialogChannel(c: MessengerChatChannel): boolean {
  return c === 'private' || c === 'group'
}

export function isGroupChannel(c: MessengerChatChannel): boolean {
  return c === 'group'
}
