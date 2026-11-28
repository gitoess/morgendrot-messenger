import { describe, expect, it, vi } from 'vitest'
import {
  fetchStealthBucketsForSlotTags,
  fetchStealthStoredEventTimestamps,
  scanStealthBucketsFromMailbox,
  stealthStoredEventMapKey,
} from './mailbox-stealth-inbox-rpc'

describe('mailbox-stealth-inbox-rpc', () => {
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const tag = new Uint8Array(32).fill(7)
  const entryFields = {
    entry_id: '0',
    ciphertext: [1, 2, 3],
    iv: Array.from({ length: 12 }, (_, i) => i),
    aes_tag: Array.from({ length: 16 }, () => 9),
    delete_commit: Array.from({ length: 32 }, () => 8),
    created_at_ms: '1700000000000',
    expires_at_ms: '1700000000000',
  }

  it('parst Bucket mit Entry aus getDynamicFieldObject', async () => {
    const client = {
      getDynamicFieldObject: vi.fn().mockResolvedValue({
        data: {
          content: {
            fields: {
              entries: [{ fields: entryFields }],
              next_entry_id: '1',
            },
          },
        },
      }),
      getDynamicFields: vi.fn(),
      multiGetObjects: vi.fn(),
    }

    const buckets = await fetchStealthBucketsForSlotTags(client as never, {
      mailboxObjectId: mb,
      callPackageId: pkg,
      slotTags: [tag],
    })
    expect(buckets).toHaveLength(1)
    expect(buckets[0]!.entries).toHaveLength(1)
    expect(buckets[0]!.entries[0]!.ciphertext).toEqual(new Uint8Array([1, 2, 3]))
    expect(buckets[0]!.entries[0]!.entryId).toBe(0n)
  })

  it('scanStealthBucketsFromMailbox findet StealthSlotKey per DOF-Liste', async () => {
    const oid = '0x' + 'aa'.repeat(32)
    const client = {
      getDynamicFields: vi.fn().mockResolvedValue({
        data: [
          {
            objectId: oid,
            name: {
              type: `${pkg}::messaging::StealthSlotKey`,
              value: { tag: Array.from(tag) },
            },
          },
        ],
        hasNextPage: false,
      }),
      multiGetObjects: vi.fn().mockResolvedValue([
        {
          data: {
            content: {
              fields: {
                entries: [{ fields: entryFields }],
                next_entry_id: '1',
              },
            },
          },
        },
      ]),
    }

    const buckets = await scanStealthBucketsFromMailbox(client as never, {
      mailboxObjectId: mb,
      callPackageId: pkg,
    })
    expect(buckets).toHaveLength(1)
    expect(buckets[0]!.objectId).toBe(oid)
    expect(buckets[0]!.entries[0]!.aesTag).toHaveLength(16)
  })

  it('überspringt fehlende Buckets bei getDynamicFieldObject → Scan-Fallback leer', async () => {
    const client = {
      getDynamicFieldObject: vi.fn().mockResolvedValue({ data: { error: { code: 'notFound' } } }),
      getDynamicFields: vi.fn().mockResolvedValue({ data: [], hasNextPage: false }),
      multiGetObjects: vi.fn(),
    }
    const buckets = await fetchStealthBucketsForSlotTags(client as never, {
      mailboxObjectId: mb,
      callPackageId: pkg,
      slotTags: [tag],
    })
    expect(buckets).toEqual([])
  })

  it('fetchStealthStoredEventTimestamps mappt slot_tag+entry_id → timestampMs', async () => {
    const client = {
      queryEvents: vi.fn().mockResolvedValue({
        data: [
          {
            timestampMs: '1795883211893',
            parsedJson: { entry_id: '2', slot_tag: Array.from(tag) },
          },
        ],
      }),
    }
    const map = await fetchStealthStoredEventTimestamps(client as never, { callPackageId: pkg })
    expect(map.get(stealthStoredEventMapKey(tag, 2))).toBe(1795883211893)
  })
})
