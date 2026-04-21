import { describe, it, expect, beforeEach } from 'vitest'
import { OFFLINE_MAILBOX_QUEUE_STORAGE_KEY, OFFLINE_QUEUE_ITEM_STATUS } from './model'
import { createMemoryStringStorage } from '../../ports/storage-memory'
import { createFixedClock } from '../../ports/clock-impl'
import { createSequencedIdGenerator } from '../../ports/id-generator'
import { createOfflineMailboxManager } from './manager'

describe('createOfflineMailboxManager', () => {
  let storage: ReturnType<typeof createMemoryStringStorage>
  let clock: ReturnType<typeof createFixedClock>
  let mgr: ReturnType<typeof createOfflineMailboxManager>

  beforeEach(() => {
    storage = createMemoryStringStorage()
    clock = createFixedClock(1_000)
    mgr = createOfflineMailboxManager({
      storage,
      clock,
      ids: createSequencedIdGenerator('t'),
      queueStorageKey: OFFLINE_MAILBOX_QUEUE_STORAGE_KEY,
    })
  })

  it('load/save roundtrip', () => {
    expect(mgr.load()).toEqual([])
    mgr.save([
      {
        id: 'a',
        kind: 'encrypted_send',
        status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
        recipient: '0x',
        payload: 'p',
        encrypted: true,
        timeIsTrusted: false,
        clientOutSeq: 1,
        createdAt: 1,
        attempts: 0,
        lastAttemptAt: 0,
        priority: 100,
      },
    ])
    expect(mgr.load()).toHaveLength(1)
    expect(mgr.count()).toBe(1)
  })

  it('enqueueFailure persistiert und erhöht clientOutSeq', async () => {
    await expect(
      mgr.enqueueFailure({
        kind: 'encrypted_send',
        recipient: '0xr',
        payload: 'wire',
        encrypted: true,
        timeIsTrusted: true,
        lastError: 'net',
      })
    ).resolves.toEqual({ ok: true, queued: true })
    expect(mgr.nextClientOutSeq()).toBe(2)
    const items = mgr.load()
    expect(items[0]?.id).toBe('t-1')
    expect(items[0]?.createdAt).toBe(1_000)
    expect(items[0]?.priority).toBe(100)
    expect(items[0]?.canonicalMsgRef).toMatch(/^[0-9a-f]{64}$/)
  })

  it('dedupliziert ohne zweiten Speicher-Schreib', async () => {
    const p = {
      kind: 'encrypted_send' as const,
      recipient: '0x',
      payload: 'same',
      encrypted: true,
      timeIsTrusted: false,
    }
    await expect(mgr.enqueueFailure(p)).resolves.toEqual({ ok: true, queued: true })
    await expect(mgr.enqueueFailure(p)).resolves.toEqual({ ok: true, queued: false })
    expect(mgr.load()).toHaveLength(1)
  })

  it('drainOnce nutzt SendPort und persistiert', async () => {
    await mgr.enqueueFailure({
      kind: 'plain_send',
      recipient: '0xz',
      payload: 'drain-me',
      encrypted: false,
      timeIsTrusted: true,
    })
    const r = await mgr.drainOnce({
      sendEncrypted: async () => ({ ok: false }),
      sendPlain: async () => ({ ok: true }),
    })
    expect(r.sent).toBe(1)
    expect(r.remaining).toBe(0)
    expect(mgr.load()).toHaveLength(0)
  })
})
