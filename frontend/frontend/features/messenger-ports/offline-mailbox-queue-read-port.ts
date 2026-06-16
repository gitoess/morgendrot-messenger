export type OfflineMailboxQueueItem = {
  id: string
  recipient: string
  createdAt: number
  attempts: number
  lastError?: string
}

/** Offline-Mailbox-Warteschlange (readonly) für Send-Panel und Shell-Banner. */
export type OfflineMailboxQueueReadPort = {
  readonly pending: number
  readonly untrustedTimeCount: number
  readonly backoffCount: number
  readonly errorHint?: string
  readonly items: readonly OfflineMailboxQueueItem[]
  readonly removeItems: (ids: string[]) => void
}

export function asOfflineMailboxQueueRead(
  pending: number,
  untrustedTimeCount: number,
  backoffCount: number,
  errorHint: string | undefined,
  items: readonly OfflineMailboxQueueItem[],
  removeItems: (ids: string[]) => void
): OfflineMailboxQueueReadPort {
  return { pending, untrustedTimeCount, backoffCount, errorHint, items, removeItems }
}
