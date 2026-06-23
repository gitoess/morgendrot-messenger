'use client'

/** Lokaler Zustand für Team-Update-Empfang (§7.2). */

const LS_REJECTED_SEQ = 'morgendrot.rejectedTeamUpdates'
const LS_LAST_APPLIED_SEQ = 'morgendrot.lastAppliedTeamUpdateSeq'

export function readLastAppliedTeamUpdateSeq(): number {
  if (typeof window === 'undefined') return 0
  try {
    const n = Number(window.localStorage.getItem(LS_LAST_APPLIED_SEQ) || '0')
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function markTeamUpdateSeqApplied(seq: number): void {
  if (typeof window === 'undefined' || !Number.isFinite(seq)) return
  try {
    const prev = readLastAppliedTeamUpdateSeq()
    if (seq > prev) window.localStorage.setItem(LS_LAST_APPLIED_SEQ, String(seq))
  } catch {
    /* ignore */
  }
}

export function readRejectedTeamUpdateSeqs(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_REJECTED_SEQ)
    if (!raw) return []
    const list = JSON.parse(raw) as number[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function rejectTeamUpdateSeq(seq: number): void {
  if (typeof window === 'undefined') return
  try {
    const list = readRejectedTeamUpdateSeqs()
    if (!list.includes(seq)) list.push(seq)
    window.localStorage.setItem(LS_REJECTED_SEQ, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function isTeamUpdateSeqRejected(seq: number): boolean {
  return readRejectedTeamUpdateSeqs().includes(seq)
}

export function shouldShowTeamMemberUpdate(seq: number): boolean {
  if (seq <= readLastAppliedTeamUpdateSeq()) return false
  if (isTeamUpdateSeqRejected(seq)) return false
  return true
}
