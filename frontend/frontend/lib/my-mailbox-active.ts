/**
 * Ein aktives Send-/Posteingang-Ziel: Team- oder Private-Mailbox (nicht Server-Shared).
 * Server-MAILBOX_ID (.env) wird immer separat mitgelesen.
 *
 * § H.24b P3 Adoption: aktive Mailbox pro Einsatzprofil (scoped localStorage).
 */

import { readScoped, removeScoped, writeScoped } from '@/frontend/lib/package-profile-namespace'

const ACTIVE_MAILBOX_DOMAIN = 'activeMailbox'

export type ActiveSendMailbox =
  | { kind: 'none' }
  | { kind: 'team'; objectId: string }
  | { kind: 'private'; objectId: string }

export const ACTIVE_SERVER_MAILBOX = '__server__'
export const ACTIVE_MAILBOX_CHANGED_EVENT = 'morg:active-mailbox-changed'

const LS_ACTIVE = 'morgendrot.activeSendMailbox.v3'
const LS_LEGACY = 'morgendrot.activePrivateMailboxObjectId.v2'
const PREFIX_TEAM = 'team:'
const PREFIX_PRIVATE = 'private:'

function isValidObjectId(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/i.test(id.trim())
}

export function notifyActiveMailboxChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(ACTIVE_MAILBOX_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

function readActiveRaw(): string {
  if (typeof window === 'undefined') return ''
  const v3 = (readScoped(ACTIVE_MAILBOX_DOMAIN, LS_ACTIVE) ?? '').trim()
  if (v3) return v3
  return (readScoped(ACTIVE_MAILBOX_DOMAIN, LS_LEGACY) ?? '').trim()
}

function writeActiveRaw(value: string): void {
  if (typeof window === 'undefined') return
  const t = value.trim()
  if (!t) removeScoped(ACTIVE_MAILBOX_DOMAIN, LS_ACTIVE)
  else writeScoped(ACTIVE_MAILBOX_DOMAIN, LS_ACTIVE, t)
}

export function readActiveSendMailbox(): ActiveSendMailbox {
  const raw = readActiveRaw()
  if (!raw || raw === ACTIVE_SERVER_MAILBOX) return { kind: 'none' }
  if (raw.startsWith(PREFIX_TEAM)) {
    const id = raw.slice(PREFIX_TEAM.length).trim()
    if (isValidObjectId(id)) return { kind: 'team', objectId: id }
  }
  if (raw.startsWith(PREFIX_PRIVATE)) {
    const id = raw.slice(PREFIX_PRIVATE.length).trim()
    if (isValidObjectId(id)) return { kind: 'private', objectId: id }
  }
  if (isValidObjectId(raw)) return { kind: 'private', objectId: raw }
  return { kind: 'none' }
}

/** Aktive Object-ID für Posteingang-Zusatz-Fetch und Senden (ohne Server-Shared). */
export function readActiveSendMailboxObjectId(): string {
  const sel = readActiveSendMailbox()
  return sel.kind === 'none' ? '' : sel.objectId
}

export function clearActiveSendMailbox(): void {
  writeActiveRaw(ACTIVE_SERVER_MAILBOX)
  notifyActiveMailboxChanged()
}

export function setActiveTeamMailboxObjectId(objectId: string): void {
  const id = objectId.trim()
  if (!isValidObjectId(id)) return
  writeActiveRaw(`${PREFIX_TEAM}${id}`)
  notifyActiveMailboxChanged()
}

export function setActivePrivateMailboxObjectId(objectId: string): void {
  const id = objectId.trim()
  if (!isValidObjectId(id)) return
  writeActiveRaw(`${PREFIX_PRIVATE}${id}`)
  notifyActiveMailboxChanged()
}
