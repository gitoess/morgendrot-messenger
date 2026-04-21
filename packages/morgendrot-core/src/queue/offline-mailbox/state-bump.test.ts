import { describe, it, expect } from 'vitest'
import { OFFLINE_QUEUE_ITEM_STATUS, type OfflineMailboxQueueItem } from './model'
import { bumpOfflineMailboxItemAfterFailedSend } from './state'

describe('bumpOfflineMailboxItemAfterFailedSend', () => {
  it('erhöht attempts und setzt lastError', () => {
    const item: OfflineMailboxQueueItem = {
      id: 'x',
      kind: 'plain_send',
      status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
      recipient: '0x',
      payload: 'p',
      encrypted: false,
      timeIsTrusted: false,
      clientOutSeq: 1,
      createdAt: 1,
      attempts: 0,
      lastAttemptAt: 0,
      priority: 100,
    }
    const b = bumpOfflineMailboxItemAfterFailedSend(item, new Error('boom'), 99)
    expect(b.attempts).toBe(1)
    expect(b.lastAttemptAt).toBe(99)
    expect(b.lastError).toContain('boom')
    expect(b.status).toBe(OFFLINE_QUEUE_ITEM_STATUS.PENDING)
  })
})
