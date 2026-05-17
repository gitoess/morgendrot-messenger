'use client'

import type { Message } from '@/frontend/lib/types'

const LS_KEY = 'morgendrot.meshLocalMessages.v1'
const MAX = 200

function isMeshRow(m: unknown): m is Message {
  if (!m || typeof m !== 'object') return false
  const o = m as Message
  return typeof o.id === 'string' && typeof o.from === 'string' && typeof o.content === 'string' && typeof o.timestamp === 'number'
}

export function loadMeshArchive(): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter(isMeshRow).filter((m) => m.transports?.includes('mesh'))
  } catch {
    return []
  }
}

export function appendMeshToLocalArchive(msg: Message): void {
  if (typeof window === 'undefined') return
  if (!msg.transports?.includes('mesh')) return
  try {
    const cur = loadMeshArchive()
    if (cur.some((m) => m.id === msg.id)) return
    const next = [msg, ...cur].slice(0, MAX)
    window.localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    /* Quota / private mode */
  }
}

/** Mesh aus React-State + Archiv (ohne doppelte `id`). */
export function pickMeshRowsForInboxMerge(prev: Message[]): Message[] {
  const fromPrev = prev.filter((m) => m.transports?.includes('mesh'))
  const ids = new Set(fromPrev.map((m) => m.id))
  const fromArch = loadMeshArchive().filter((m) => !ids.has(m.id))
  return [...fromPrev, ...fromArch]
}

function isTelegramInboxRow(m: Message): boolean {
  return m.source === 'telegram' || Boolean(m.transports?.includes('telegram'))
}

/** Lokale Overlay-Zeilen (Mesh-Archiv + Telegram-Journal im State) beim Mailbox-Reload behalten. */
export function pickLocalOverlayRowsForInboxMerge(prev: Message[]): Message[] {
  const mesh = pickMeshRowsForInboxMerge(prev)
  const meshIds = new Set(mesh.map((m) => m.id))
  const telegram = prev.filter((m) => isTelegramInboxRow(m) && !meshIds.has(m.id))
  return [...mesh, ...telegram]
}
