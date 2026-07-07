'use client'

import {
  DEFAULT_TEAM_BROADCAST_KEY_EPOCH,
  generateTeamBroadcastKeyRaw,
  teamBroadcastKeyFromBase64,
  teamBroadcastKeyToBase64,
} from '@morgendrot/shared/morgendrot-team-broadcast-crypto'

const LS_KEY_PREFIX = 'morgendrot.teamBroadcastKey.v1:'
const LS_EPOCH_PREFIX = 'morgendrot.teamBroadcastKeyEpoch.v1:'

function normMb(teamMailboxObjectId: string): string {
  return teamMailboxObjectId.trim().toLowerCase()
}

export function hasTeamBroadcastKey(teamMailboxObjectId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = window.localStorage.getItem(LS_KEY_PREFIX + normMb(teamMailboxObjectId))
    return Boolean(v?.trim())
  } catch {
    return false
  }
}

export function readTeamBroadcastKeyRaw(teamMailboxObjectId: string): Uint8Array | null {
  if (typeof window === 'undefined') return null
  try {
    const b64 = window.localStorage.getItem(LS_KEY_PREFIX + normMb(teamMailboxObjectId))?.trim()
    if (!b64) return null
    return teamBroadcastKeyFromBase64(b64)
  } catch {
    return null
  }
}

export function writeTeamBroadcastKeyRaw(teamMailboxObjectId: string, raw32: Uint8Array): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_KEY_PREFIX + normMb(teamMailboxObjectId), teamBroadcastKeyToBase64(raw32))
}

export function writeTeamBroadcastKeyEpoch(teamMailboxObjectId: string, epoch: number): void {
  if (typeof window === 'undefined') return
  const n = Number.isFinite(epoch) && epoch >= 1 ? Math.floor(epoch) : DEFAULT_TEAM_BROADCAST_KEY_EPOCH
  window.localStorage.setItem(LS_EPOCH_PREFIX + normMb(teamMailboxObjectId), String(n))
}

export function readTeamBroadcastKeyEpoch(teamMailboxObjectId: string): number {
  if (typeof window === 'undefined') return DEFAULT_TEAM_BROADCAST_KEY_EPOCH
  try {
    const n = Number(window.localStorage.getItem(LS_EPOCH_PREFIX + normMb(teamMailboxObjectId)) || '')
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_TEAM_BROADCAST_KEY_EPOCH
  } catch {
    return DEFAULT_TEAM_BROADCAST_KEY_EPOCH
  }
}

/** Erzeugt lokalen Team-Key falls noch keiner für diese Team-Mailbox existiert (Boss-Setup). */
export function ensureTeamBroadcastKey(teamMailboxObjectId: string): Uint8Array {
  const existing = readTeamBroadcastKeyRaw(teamMailboxObjectId)
  if (existing) return existing
  const raw = generateTeamBroadcastKeyRaw()
  writeTeamBroadcastKeyRaw(teamMailboxObjectId, raw)
  return raw
}
