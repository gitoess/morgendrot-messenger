'use client'

/**
 * `.morgendrot-handoff-extras.json` — optionale Handoff-Metadaten (B4b.2).
 * @see docs/TELEGRAM-INTEGRATION-ZIELBILD.md §6.6.1
 */

export const HANDOFF_EXTRAS_FILENAME = '.morgendrot-handoff-extras.json'

export type HandoffTelegramAlarmGroup = {
  label?: string
  inviteLink?: string
  chatId?: string
}

/** § H.23 B1 — symmetrischer Team-Broadcast-Key (32 B Base64), nie on-chain. */
export type HandoffTeamBroadcastKeyEntry = {
  teamMailboxObjectId: string
  keyBase64: string
  keyEpoch?: number
  groupName?: string
}

export type HandoffExtras = {
  telegramAlarmGroup?: HandoffTelegramAlarmGroup
  teamBroadcastKeys?: HandoffTeamBroadcastKeyEntry[]
}

const LS_HANDOFF_EXTRAS = 'morgendrot.handoff.extras.v1'
export const HANDOFF_EXTRAS_CHANGED_EVENT = 'morgendrot.handoffExtrasChanged' as const

export function parseHandoffExtrasJson(text: string): HandoffExtras | null {
  const raw = text.trim()
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as HandoffExtras
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null
    return o
  } catch {
    return null
  }
}

export function readHandoffExtras(): HandoffExtras | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_HANDOFF_EXTRAS)
    if (!raw) return null
    return parseHandoffExtrasJson(raw)
  } catch {
    return null
  }
}

export function saveHandoffExtras(extras: HandoffExtras): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_HANDOFF_EXTRAS, JSON.stringify(extras))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(HANDOFF_EXTRAS_CHANGED_EVENT))
}

export function clearHandoffExtras(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_HANDOFF_EXTRAS)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(HANDOFF_EXTRAS_CHANGED_EVENT))
}

export function buildHandoffExtrasJson(extras: HandoffExtras): string {
  return `${JSON.stringify(extras, null, 2)}\n`
}

export function readTelegramInviteFromHandoffExtras(): string {
  return readHandoffExtras()?.telegramAlarmGroup?.inviteLink?.trim() || ''
}

export function readTelegramLabelFromHandoffExtras(): string {
  return readHandoffExtras()?.telegramAlarmGroup?.label?.trim() || ''
}
