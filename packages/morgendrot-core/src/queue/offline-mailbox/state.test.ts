import { describe, it, expect } from 'vitest'
import { OFFLINE_QUEUE_ITEM_STATUS, type OfflineMailboxQueueItem } from './model.js'
import {
  offlineMailboxDedupKey,
  maxClientOutSeqIn,
  nextClientOutSeqFromItems,
  sortOfflineMailboxForDrain,
  backoffMsForDrainAttempt,
  shouldDeferDrainAttempt,
  tryEnqueueOfflineMailboxItem,
} from './state.js'

describe('offlineMailboxDedupKey', () => {
  it('ist stabil für gleiche Nutzlast', () => {
    const p = { kind: 'encrypted_send' as const, recipient: '0xabc', encrypted: true, payload: 'hello' }
    expect(offlineMailboxDedupKey(p)).toBe(offlineMailboxDedupKey(p))
  })

  it('unterscheidet Empfänger', () => {
    expect(
      offlineMailboxDedupKey({ kind: 'plain_send', recipient: '0x1', encrypted: false, payload: 'x' })
    ).not.toBe(offlineMailboxDedupKey({ kind: 'plain_send', recipient: '0x2', encrypted: false, payload: 'x' }))
  })
})

describe('clientOutSeq', () => {
  it('nextClientOutSeqFromItems = max + 1', () => {
    const items: OfflineMailboxQueueItem[] = [
      {
        id: 'a',
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
    ]
    expect(maxClientOutSeqIn(items)).toBe(7)
    expect(nextClientOutSeqFromItems(items)).toBe(8)
  })
})

describe('sortOfflineMailboxForDrain', () => {
  it('sortiert nach clientOutSeq dann createdAt', () => {
    const a: OfflineMailboxQueueItem = {
      id: '1',
      kind: 'plain_send',
      status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
      recipient: '0x',
      payload: 'a',
      encrypted: false,
      timeIsTrusted: false,
      clientOutSeq: 2,
      createdAt: 100,
      attempts: 0,
      lastAttemptAt: 0,
    }
    const b: OfflineMailboxQueueItem = {
      ...a,
      id: '2',
      clientOutSeq: 2,
      createdAt: 50,
    }
    const c: OfflineMailboxQueueItem = { ...a, id: '3', clientOutSeq: 1 }
    const sorted = sortOfflineMailboxForDrain([a, b, c])
    expect(sorted.map((x) => x.id)).toEqual(['3', '2', '1'])
  })
})

describe('backoffMsForDrainAttempt / shouldDeferDrainAttempt', () => {
  it('defer bei frischem Fehlversuch', () => {
    const item: OfflineMailboxQueueItem = {
      id: 'x',
      kind: 'encrypted_send',
      status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
      recipient: '0x',
      payload: 'p',
      encrypted: true,
      timeIsTrusted: false,
      clientOutSeq: 1,
      createdAt: 1,
      attempts: 1,
      lastAttemptAt: 1000,
    }
    const wait = backoffMsForDrainAttempt(1)
    expect(shouldDeferDrainAttempt(item, 1000 + wait - 1)).toBe(true)
    expect(shouldDeferDrainAttempt(item, 1000 + wait)).toBe(false)
  })

  it('kein defer bei attempts 0', () => {
    const item: OfflineMailboxQueueItem = {
      id: 'x',
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
    }
    expect(shouldDeferDrainAttempt(item, 999_999)).toBe(false)
  })
})

describe('tryEnqueueOfflineMailboxItem', () => {
  const base = (): OfflineMailboxQueueItem[] => []

  it('legt pending-Eintrag an', () => {
    const r = tryEnqueueOfflineMailboxItem({
      items: base(),
      kind: 'encrypted_send',
      recipient: '0xr ',
      payload: 'wire',
      encrypted: true,
      timeIsTrusted: true,
      lastError: 'net',
      id: 'id-1',
      now: 42,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.queued).toBe(true)
    expect(r.items).toHaveLength(1)
    expect(r.items[0]?.recipient).toBe('0xr')
    expect(r.items[0]?.payload).toBe('wire')
    expect(r.items[0]?.timeIsTrusted).toBe(true)
    expect(r.items[0]?.clientOutSeq).toBe(1)
    expect(r.items[0]?.createdAt).toBe(42)
  })

  it('dedupliziert gleichen Inhalt', () => {
    const first = tryEnqueueOfflineMailboxItem({
      items: base(),
      kind: 'encrypted_send',
      recipient: '0xr',
      payload: 'same',
      encrypted: true,
      timeIsTrusted: false,
      lastError: 'e',
      id: 'a',
      now: 1,
    })
    expect(first.ok && first.queued).toBe(true)
    if (!first.ok || !first.queued) return
    const second = tryEnqueueOfflineMailboxItem({
      items: first.items,
      kind: 'encrypted_send',
      recipient: '0xr',
      payload: 'same',
      encrypted: true,
      timeIsTrusted: false,
      id: 'b',
      now: 2,
    })
    expect(second.ok && second.queued === false).toBe(true)
    if (!second.ok) return
    expect(second.items).toHaveLength(1)
  })

  it('lehnt Nutzlast zu groß ab', () => {
    const big = 'x'.repeat(512_001)
    const r = tryEnqueueOfflineMailboxItem({
      items: base(),
      kind: 'plain_send',
      recipient: '0x',
      payload: big,
      encrypted: false,
      timeIsTrusted: false,
      id: 'x',
      now: 1,
    })
    expect(r).toEqual({ ok: false, queued: false, reason: 'Nutzlaste zu groß für lokale Warteschlange.' })
  })

  it('vergibt monoton steigende clientOutSeq', () => {
    let items = base()
    const r1 = tryEnqueueOfflineMailboxItem({
      items,
      kind: 'encrypted_send',
      recipient: '0x1',
      payload: 'a',
      encrypted: true,
      timeIsTrusted: true,
      id: '1',
      now: 1,
    })
    if (!r1.ok || !r1.queued) throw new Error('expected queued')
    items = r1.items
    const r2 = tryEnqueueOfflineMailboxItem({
      items,
      kind: 'encrypted_send',
      recipient: '0x1',
      payload: 'b',
      encrypted: true,
      timeIsTrusted: true,
      id: '2',
      now: 2,
    })
    if (!r2.ok || !r2.queued) throw new Error('expected queued')
    const seqs = r2.items.map((x) => x.clientOutSeq).sort((a, b) => a - b)
    expect(seqs).toEqual([1, 2])
  })
})
