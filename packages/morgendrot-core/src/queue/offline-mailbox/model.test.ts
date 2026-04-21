import { describe, it, expect } from 'vitest'
import {
  OFFLINE_MAILBOX_MAX_ITEMS,
  OFFLINE_MAILBOX_MAX_PAYLOAD_CHARS,
  OFFLINE_MAILBOX_PRIORITY_DEFAULT,
  OFFLINE_MAILBOX_QUEUE_STORAGE_KEY,
  OFFLINE_QUEUE_ITEM_STATUS,
} from './model'

describe('offline-mailbox model constants', () => {
  it('behält erwartete Grenzen (Kompatibilität mit PWA-MVP)', () => {
    expect(OFFLINE_MAILBOX_MAX_ITEMS).toBe(60)
    expect(OFFLINE_MAILBOX_MAX_PAYLOAD_CHARS).toBe(512_000)
    expect(OFFLINE_MAILBOX_PRIORITY_DEFAULT).toBe(100)
    expect(OFFLINE_MAILBOX_QUEUE_STORAGE_KEY).toBe('morgendrot.offline-mailbox-queue.v1')
    expect(OFFLINE_QUEUE_ITEM_STATUS.PENDING).toBe('pending')
  })
})
