/**
 * Eingangs-Ton bei neuer Inbox-Nachricht — getrennt von Klack/Klick (UI-Feedback).
 * Default: Master **aus** (kein Überraschungs-Piep).
 */

export const INCOMING_MESSAGE_TONE_PREFS_CHANGED = 'morgendrot:incoming-message-tone-prefs-changed'

const LS_MASTER = 'morgendrot.inbox.incomingTone.master.v1'
const LS_DIALOG = 'morgendrot.inbox.incomingTone.dialog.v1'
const LS_GROUP = 'morgendrot.inbox.incomingTone.group.v1'
const LS_PINNWAND = 'morgendrot.inbox.incomingTone.pinnwand.v1'

/** Kanal-*Typen* (nicht jeder Kontakt einzeln — das ist T53 Stumm-pro-Chat). */
export type IncomingToneChannel = 'dialog' | 'group' | 'pinnwand'

function emitChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(INCOMING_MESSAGE_TONE_PREFS_CHANGED))
  } catch {
    /* ignore */
  }
}

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    /* ignore */
  }
  return fallback
}

function writeBool(key: string, value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value ? '1' : '0')
    emitChanged()
  } catch {
    /* ignore */
  }
}

/** Master — Default aus. */
export function readIncomingToneMasterEnabled(): boolean {
  return readBool(LS_MASTER, false)
}

export function persistIncomingToneMasterEnabled(on: boolean): void {
  writeBool(LS_MASTER, on)
}

/** Typ-Schalter — Default an, greifen nur wenn Master an. */
export function readIncomingToneChannelEnabled(ch: IncomingToneChannel): boolean {
  switch (ch) {
    case 'group':
      return readBool(LS_GROUP, true)
    case 'pinnwand':
      return readBool(LS_PINNWAND, true)
    default:
      return readBool(LS_DIALOG, true)
  }
}

export function persistIncomingToneChannelEnabled(ch: IncomingToneChannel, on: boolean): void {
  switch (ch) {
    case 'group':
      writeBool(LS_GROUP, on)
      break
    case 'pinnwand':
      writeBool(LS_PINNWAND, on)
      break
    default:
      writeBool(LS_DIALOG, on)
  }
}

export function incomingToneChannelLabel(ch: IncomingToneChannel): string {
  switch (ch) {
    case 'group':
      return 'Gruppe / Team-Broadcast'
    case 'pinnwand':
      return 'Pinnwand'
    default:
      return '1:1 / Dialog'
  }
}
