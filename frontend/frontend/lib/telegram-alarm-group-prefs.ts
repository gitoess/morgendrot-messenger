'use client'

/** Telegram-Alarmgruppe — Wizard / Posteingang-Präferenzen (§6.6.1, §7.4). */

const LS_DISMISSED = 'morgendrot.telegramAlarmGroupDismissed'
const LS_OPEN_ON_STEP = 'morgendrot.telegramOpenInviteOnStep'
const LS_PENDING = 'morgendrot.telegramAlarmGroupPending'
const LS_JOIN_INITIATED = 'morgendrot.telegramAlarmGroupJoinInitiated'
const LS_MEMBERSHIP = 'morgendrot.telegramAlarmGroupMembership'
const LS_APPLIED_TG_SEQ = 'morgendrot.appliedTelegramGroupTgSeq'
const LS_DISMISSED_TG_SEQ = 'morgendrot.dismissedTelegramGroupTgSeq'
const LS_SNOOZED = 'morgendrot.snoozedTelegramGroupCards'

export function isTelegramAlarmGroupWizardDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_DISMISSED) === '1'
  } catch {
    return false
  }
}

export function setTelegramAlarmGroupWizardDismissed(dismissed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (dismissed) window.localStorage.setItem(LS_DISMISSED, '1')
    else window.localStorage.removeItem(LS_DISMISSED)
  } catch {
    /* ignore */
  }
}

export function readTelegramOpenInviteOnStep(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_OPEN_ON_STEP) === '1'
  } catch {
    return false
  }
}

export function writeTelegramOpenInviteOnStep(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) window.localStorage.setItem(LS_OPEN_ON_STEP, '1')
    else window.localStorage.removeItem(LS_OPEN_ON_STEP)
  } catch {
    /* ignore */
  }
}

export type TelegramAlarmGroupPending = {
  label?: string
  inviteLink: string
  tgSeq?: number
  boss?: string
  savedAtMs: number
}

export const TELEGRAM_ALARM_INBOX_PARTNER_KEY = 'telegram-alarm:membership' as const

export const TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT =
  'morgendrot.telegramAlarmGroupJoinChanged' as const

export type TelegramAlarmGroupJoinInitiated = {
  inviteLink: string
  atMs: number
}

function notifyTelegramJoinChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT))
}

export function markTelegramAlarmGroupJoinInitiated(inviteLink: string): void {
  if (typeof window === 'undefined') return
  try {
    const envelope: TelegramAlarmGroupJoinInitiated = {
      inviteLink: inviteLink.trim(),
      atMs: Date.now(),
    }
    window.localStorage.setItem(LS_JOIN_INITIATED, JSON.stringify(envelope))
  } catch {
    /* ignore */
  }
  notifyTelegramJoinChanged()
}

export function readTelegramAlarmGroupJoinInitiated(): TelegramAlarmGroupJoinInitiated | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_JOIN_INITIATED)
    if (!raw) return null
    const o = JSON.parse(raw) as TelegramAlarmGroupJoinInitiated
    if (!o?.inviteLink?.trim()) return null
    return o
  } catch {
    return null
  }
}

export function isTelegramAlarmGroupJoinInitiatedForLink(inviteLink: string): boolean {
  const hit = readTelegramAlarmGroupJoinInitiated()
  if (!hit) return false
  return hit.inviteLink.trim() === inviteLink.trim()
}

export type TelegramAlarmGroupMembership = {
  label?: string
  inviteLink: string
  groupChatId?: string
  confirmedAtMs: number
}

export function readTelegramAlarmGroupMembership(): TelegramAlarmGroupMembership | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_MEMBERSHIP)
    if (!raw) return null
    const o = JSON.parse(raw) as TelegramAlarmGroupMembership
    if (!o?.inviteLink?.trim()) return null
    return o
  } catch {
    return null
  }
}

export function isTelegramAlarmGroupJoined(): boolean {
  return readTelegramAlarmGroupMembership() !== null
}

export function isTelegramAlarmGroupJoinedForLink(inviteLink: string): boolean {
  const m = readTelegramAlarmGroupMembership()
  if (!m) return false
  return m.inviteLink.trim() === inviteLink.trim()
}

export function clearTelegramAlarmGroupMembership(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_MEMBERSHIP)
  } catch {
    /* ignore */
  }
  notifyTelegramJoinChanged()
}

export function patchTelegramAlarmGroupMembershipChatId(groupChatId: string): void {
  if (typeof window === 'undefined') return
  const id = groupChatId.trim()
  if (!id) return
  const m = readTelegramAlarmGroupMembership()
  if (!m) return
  try {
    window.localStorage.setItem(
      LS_MEMBERSHIP,
      JSON.stringify({ ...m, groupChatId: id })
    )
  } catch {
    /* ignore */
  }
  notifyTelegramJoinChanged()
}

/** Supergruppen-ID (typisch -100…) — gleiches Format wie Server `isValidTelegramChatId`. */
export function isValidTelegramAlarmGroupChatId(chatId: string): boolean {
  const c = chatId.trim()
  return /^-?\d{1,20}$/.test(c)
}

export function saveTelegramAlarmGroupMembershipChatId(
  groupChatId: string
): { ok: true } | { ok: false; error: string } {
  const id = groupChatId.trim()
  if (!id) return { ok: false, error: 'Gruppen-Chat-ID eingeben (z. B. -100…).' }
  if (!isValidTelegramAlarmGroupChatId(id)) {
    return { ok: false, error: 'Ungültiges Format — negative Zahl, z. B. -100123456789.' }
  }
  if (!readTelegramAlarmGroupMembership()) {
    return { ok: false, error: 'Zuerst „Beigetreten“ bestätigen.' }
  }
  patchTelegramAlarmGroupMembershipChatId(id)
  return { ok: true }
}

export function confirmTelegramAlarmGroupJoined(extra?: {
  label?: string
  inviteLink?: string
  groupChatId?: string
}): void {
  if (typeof window === 'undefined') return
  const pending = readTelegramAlarmGroupPending()
  const initiated = readTelegramAlarmGroupJoinInitiated()
  const inviteLink =
    extra?.inviteLink?.trim() ||
    pending?.inviteLink?.trim() ||
    initiated?.inviteLink?.trim() ||
    ''
  try {
    window.localStorage.removeItem(LS_JOIN_INITIATED)
    if (inviteLink) {
      const membership: TelegramAlarmGroupMembership = {
        inviteLink,
        label: extra?.label?.trim() || pending?.label?.trim() || undefined,
        groupChatId: extra?.groupChatId?.trim() || undefined,
        confirmedAtMs: Date.now(),
      }
      window.localStorage.setItem(LS_MEMBERSHIP, JSON.stringify(membership))
    }
  } catch {
    /* ignore */
  }
  notifyTelegramJoinChanged()
}

export function saveTelegramAlarmGroupPending(p: Omit<TelegramAlarmGroupPending, 'savedAtMs'>): void {
  if (typeof window === 'undefined') return
  try {
    const envelope: TelegramAlarmGroupPending = { ...p, savedAtMs: Date.now() }
    window.localStorage.setItem(LS_PENDING, JSON.stringify(envelope))
  } catch {
    /* ignore */
  }
}

export function readTelegramAlarmGroupPending(): TelegramAlarmGroupPending | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_PENDING)
    if (!raw) return null
    const o = JSON.parse(raw) as TelegramAlarmGroupPending
    if (!o?.inviteLink?.trim()) return null
    return o
  } catch {
    return null
  }
}

export function readAppliedTelegramGroupTgSeq(): number {
  if (typeof window === 'undefined') return 0
  try {
    const n = Number(window.localStorage.getItem(LS_APPLIED_TG_SEQ) || '0')
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function markTelegramGroupTgSeqApplied(tgSeq: number): void {
  if (typeof window === 'undefined' || !Number.isFinite(tgSeq)) return
  try {
    const prev = readAppliedTelegramGroupTgSeq()
    if (tgSeq > prev) window.localStorage.setItem(LS_APPLIED_TG_SEQ, String(tgSeq))
  } catch {
    /* ignore */
  }
}

export function isTelegramGroupTgSeqDismissed(tgSeq: number): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(LS_DISMISSED_TG_SEQ)
    if (!raw) return false
    const list = JSON.parse(raw) as number[]
    return Array.isArray(list) && list.includes(tgSeq)
  } catch {
    return false
  }
}

export function dismissTelegramGroupTgSeq(tgSeq: number): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(LS_DISMISSED_TG_SEQ)
    const list: number[] = raw ? (JSON.parse(raw) as number[]) : []
    if (!list.includes(tgSeq)) list.push(tgSeq)
    window.localStorage.setItem(LS_DISMISSED_TG_SEQ, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function snoozeTelegramGroupCard(tgSeq: number): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(LS_SNOOZED)
    const list: { tgSeq: number; untilMs: number }[] = raw ? (JSON.parse(raw) as typeof list) : []
    const untilMs = Date.now() + 24 * 60 * 60 * 1000
    const filtered = list.filter((e) => e.tgSeq !== tgSeq)
    filtered.push({ tgSeq, untilMs })
    window.localStorage.setItem(LS_SNOOZED, JSON.stringify(filtered))
  } catch {
    /* ignore */
  }
}

export function isTelegramGroupCardSnoozed(tgSeq: number): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(LS_SNOOZED)
    if (!raw) return false
    const list = JSON.parse(raw) as { tgSeq: number; untilMs: number }[]
    const hit = list.find((e) => e.tgSeq === tgSeq)
    return Boolean(hit && hit.untilMs > Date.now())
  } catch {
    return false
  }
}
