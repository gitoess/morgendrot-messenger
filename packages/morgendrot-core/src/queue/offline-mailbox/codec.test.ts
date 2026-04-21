import { describe, it, expect } from 'vitest'
import { OFFLINE_MAILBOX_MAX_ITEMS, OFFLINE_QUEUE_ITEM_STATUS } from './model'
import {
  normalizeOfflineMailboxItem,
  parseOfflineMailboxQueueFromJson,
  serializeOfflineMailboxQueueToJson,
} from './codec'

describe('normalizeOfflineMailboxItem', () => {
  it('akzeptiert gültigen Eintrag', () => {
    const n = normalizeOfflineMailboxItem({
      id: '1',
      kind: 'encrypted_send',
      status: 'pending',
      recipient: '0x',
      payload: 'x',
      encrypted: true,
      createdAt: 1,
      attempts: 0,
      lastAttemptAt: 0,
      priority: 100,
    })
    expect(n).not.toBeNull()
    expect(n?.timeIsTrusted).toBe(false)
    expect(n?.clientOutSeq).toBe(0)
    expect(n?.priority).toBe(100)
  })

  it('setzt timeIsTrusted nur bei exakt true', () => {
    const n = normalizeOfflineMailboxItem({
      id: '1',
      kind: 'plain_send',
      status: 'pending',
      recipient: '0x',
      payload: 'x',
      encrypted: false,
      timeIsTrusted: true,
      clientOutSeq: 3,
      createdAt: 1,
      attempts: 0,
      lastAttemptAt: 0,
      priority: 100,
    })
    expect(n?.timeIsTrusted).toBe(true)
    expect(n?.clientOutSeq).toBe(3)
  })

  it('lehnt ungültige Felder ab', () => {
    expect(normalizeOfflineMailboxItem({})).toBeNull()
    expect(
      normalizeOfflineMailboxItem({
        id: 1,
        kind: 'encrypted_send',
        status: 'pending',
        recipient: '0x',
        payload: 'x',
        encrypted: true,
        createdAt: 1,
        attempts: 0,
        lastAttemptAt: 0,
        priority: 100,
      } as unknown as Record<string, unknown>)
    ).toBeNull()
  })
})

describe('parseOfflineMailboxQueueFromJson', () => {
  it('parst gültiges Array', () => {
    const items = parseOfflineMailboxQueueFromJson(
      JSON.stringify([
        {
          id: 'a',
          kind: 'encrypted_send',
          status: 'pending',
          recipient: '0xr',
          payload: 'p',
          encrypted: true,
          timeIsTrusted: false,
          clientOutSeq: 1,
          createdAt: 10,
          attempts: 0,
          lastAttemptAt: 0,
          priority: 100,
        },
      ])
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('a')
  })

  it('ignoriert defektes JSON', () => {
    expect(parseOfflineMailboxQueueFromJson('not-json')).toEqual([])
    expect(parseOfflineMailboxQueueFromJson(null)).toEqual([])
  })
})

describe('serializeOfflineMailboxQueueToJson', () => {
  it('kürzt auf OFFLINE_MAILBOX_MAX_ITEMS', () => {
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
      priority: 100,
    }))
    const raw = serializeOfflineMailboxQueueToJson(many)
    const round = parseOfflineMailboxQueueFromJson(raw)
    expect(round).toHaveLength(OFFLINE_MAILBOX_MAX_ITEMS)
  })
})
