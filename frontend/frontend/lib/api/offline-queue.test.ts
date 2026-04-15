import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  OFFLINE_QUEUE_ITEM_STATUS,
  offlineMailboxDedupKey,
  enqueueOfflineMailboxFailure,
  loadOfflineMailboxQueue,
  nextOfflineMailboxClientOutSeq,
  saveOfflineMailboxQueue,
} from '@/frontend/lib/api/offline-queue'

describe('offlineMailboxDedupKey', () => {
  it('ist stabil für gleiche Nutzlast', () => {
    const a = offlineMailboxDedupKey({
      kind: 'encrypted_send',
      recipient: '0xabc',
      encrypted: true,
      payload: 'hello',
    })
    const b = offlineMailboxDedupKey({
      kind: 'encrypted_send',
      recipient: '0xabc',
      encrypted: true,
      payload: 'hello',
    })
    expect(a).toBe(b)
  })

  it('unterscheidet Empfänger', () => {
    const a = offlineMailboxDedupKey({
      kind: 'plain_send',
      recipient: '0x1',
      encrypted: false,
      payload: 'x',
    })
    const b = offlineMailboxDedupKey({
      kind: 'plain_send',
      recipient: '0x2',
      encrypted: false,
      payload: 'x',
    })
    expect(a).not.toBe(b)
  })
})

describe('enqueueOfflineMailboxFailure (localStorage)', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    vi.stubGlobal(
      'localStorage',
      {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k])
        },
        key: () => null,
        length: 0,
      } as Storage
    )
    store['morgendrot.offlineMailboxQueue'] = '1'
  })

  it('legt pending-Eintrag an', async () => {
    const r = await enqueueOfflineMailboxFailure({
      kind: 'encrypted_send',
      recipient: '0xr',
      payload: 'wire',
      encrypted: true,
      timeIsTrusted: true,
      lastError: 'net',
    })
    expect(r).toEqual({ ok: true, queued: true })
    const items = loadOfflineMailboxQueue()
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe(OFFLINE_QUEUE_ITEM_STATUS.PENDING)
    expect(items[0]?.payload).toBe('wire')
    expect(items[0]?.timeIsTrusted).toBe(true)
    expect(items[0]?.clientOutSeq).toBe(1)
    expect(items[0]?.canonicalMsgRef).toMatch(/^[0-9a-f]{64}$/)
  })

  it('dedupliziert gleichen Inhalt', async () => {
    const p = {
      kind: 'encrypted_send' as const,
      recipient: '0xr',
      payload: 'same',
      encrypted: true,
      timeIsTrusted: false,
      lastError: 'e',
    }
    await expect(enqueueOfflineMailboxFailure(p)).resolves.toEqual({ ok: true, queued: true })
    await expect(enqueueOfflineMailboxFailure(p)).resolves.toEqual({ ok: true, queued: false })
    expect(loadOfflineMailboxQueue()).toHaveLength(1)
    expect(loadOfflineMailboxQueue()[0]?.clientOutSeq).toBe(1)
  })

  it('queued false wenn Opt-in aus', async () => {
    delete store['morgendrot.offlineMailboxQueue']
    const r = await enqueueOfflineMailboxFailure({
      kind: 'plain_send',
      recipient: '0xa',
      payload: 'hi',
      encrypted: false,
      timeIsTrusted: false,
    })
    expect(r).toEqual({ ok: true, queued: false })
    expect(loadOfflineMailboxQueue()).toHaveLength(0)
  })

  it('saveOfflineMailboxQueue kürzt auf MAX_ITEMS (60)', () => {
    const many = Array.from({ length: 65 }, (_, i) => ({
      id: `id-${i}`,
      kind: 'encrypted_send' as const,
      status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
      recipient: '0x',
      payload: `${i}`,
      encrypted: true,
      timeIsTrusted: false,
      clientOutSeq: i + 1,
      createdAt: i,
      attempts: 0,
      lastAttemptAt: 0,
    }))
    saveOfflineMailboxQueue(many)
    expect(loadOfflineMailboxQueue()).toHaveLength(60)
  })

  it('setzt timeIsTrusted auf false wenn Feld fehlt (Legacy-JSON)', () => {
    store['morgendrot.offline-mailbox-queue.v1'] = JSON.stringify([
      {
        id: 'legacy-1',
        kind: 'encrypted_send',
        status: 'pending',
        recipient: '0x',
        payload: 'x',
        encrypted: true,
        createdAt: 1,
        attempts: 0,
        lastAttemptAt: 0,
      },
    ])
    const row = loadOfflineMailboxQueue()[0]
    expect(row?.timeIsTrusted).toBe(false)
    expect(row?.clientOutSeq).toBe(0)
  })

  it('vergibt monoton steigende clientOutSeq für unterschiedliche Nutzlasten', async () => {
    await expect(
      enqueueOfflineMailboxFailure({
        kind: 'encrypted_send',
        recipient: '0x1',
        payload: 'a',
        encrypted: true,
        timeIsTrusted: true,
      })
    ).resolves.toEqual({ ok: true, queued: true })
    await expect(
      enqueueOfflineMailboxFailure({
        kind: 'encrypted_send',
        recipient: '0x1',
        payload: 'b',
        encrypted: true,
        timeIsTrusted: true,
      })
    ).resolves.toEqual({ ok: true, queued: true })
    const items = loadOfflineMailboxQueue().sort((a, b) => a.clientOutSeq - b.clientOutSeq)
    expect(items.map((x) => x.clientOutSeq)).toEqual([1, 2])
  })

  it('nextOfflineMailboxClientOutSeq folgt dem Maximum in der Queue', () => {
    saveOfflineMailboxQueue([
      {
        id: 'x',
        kind: 'encrypted_send',
        status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
        recipient: '0x',
        payload: 'p',
        encrypted: true,
        timeIsTrusted: false,
        clientOutSeq: 7,
        createdAt: 1,
        attempts: 0,
        lastAttemptAt: 0,
      },
    ])
    expect(nextOfflineMailboxClientOutSeq()).toBe(8)
  })
})
