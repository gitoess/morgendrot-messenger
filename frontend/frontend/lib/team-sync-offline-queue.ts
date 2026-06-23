'use client'

/** Boss-Offline-Queue für fehlgeschlagene Team-Sync-Publishes (§ H.36 P3). */

export type TeamSyncQueueItem =
  | {
      id: string
      kind: 'member_update'
      createdAtMs: number
      teamMailboxAddress: string
      teamId: string
      bossAddress: string
      memberKind: 'add' | 'update' | 'remove'
      member: Record<string, unknown>
    }
  | {
      id: string
      kind: 'telegram_group'
      createdAtMs: number
      teamMailboxAddress: string
      teamId: string
      bossAddress: string
      label?: string
      inviteLink: string
    }

const LS_QUEUE = 'morgendrot.teamSyncOfflineQueue.v1'
export const TEAM_SYNC_QUEUE_CHANGED_EVENT = 'morgendrot.teamSyncQueueChanged' as const

function readQueue(): TeamSyncQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_QUEUE)
    if (!raw) return []
    const list = JSON.parse(raw) as TeamSyncQueueItem[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeQueue(list: TeamSyncQueueItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_QUEUE, JSON.stringify(list))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(TEAM_SYNC_QUEUE_CHANGED_EVENT))
}

export type TeamSyncQueueItemInput =
  | Omit<Extract<TeamSyncQueueItem, { kind: 'member_update' }>, 'id' | 'createdAtMs'>
  | Omit<Extract<TeamSyncQueueItem, { kind: 'telegram_group' }>, 'id' | 'createdAtMs'>

export function enqueueTeamSyncItem(item: TeamSyncQueueItemInput): void {
  const list = readQueue()
  const entry: TeamSyncQueueItem = {
    ...item,
    id: `tsq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAtMs: Date.now(),
  } as TeamSyncQueueItem
  list.push(entry)
  writeQueue(list.slice(-20))
}

export function listTeamSyncQueueItems(): TeamSyncQueueItem[] {
  return readQueue()
}

export function removeTeamSyncQueueItem(id: string): void {
  writeQueue(readQueue().filter((e) => e.id !== id))
}

export function clearTeamSyncQueue(): void {
  writeQueue([])
}
