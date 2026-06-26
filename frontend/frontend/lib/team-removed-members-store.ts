'use client'

/** Boss-seitig: Team-Entfernung per Wire gesendet (Button-Zustand „Entfernt“). */

const LS_KEY = 'morgendrot.teamRemovedMemberAddresses.v1'

function readSet(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return new Set()
    const list = JSON.parse(raw) as string[]
    return new Set(Array.isArray(list) ? list.map((a) => a.trim().toLowerCase()).filter(Boolean) : [])
  } catch {
    return new Set()
  }
}

function writeSet(set: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
}

export function markTeamMemberRemoveSent(address: string): void {
  const addr = address.trim().toLowerCase()
  if (!addr) return
  const next = readSet()
  next.add(addr)
  writeSet(next)
}

export function isTeamMemberRemoveSent(address: string): boolean {
  return readSet().has(address.trim().toLowerCase())
}

export function clearTeamMemberRemoveSent(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}
