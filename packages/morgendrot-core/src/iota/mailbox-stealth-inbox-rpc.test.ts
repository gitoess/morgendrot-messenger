import { describe, expect, it, vi } from 'vitest'
import { fetchStealthBucketsForSlotTags } from './mailbox-stealth-inbox-rpc'

describe('mailbox-stealth-inbox-rpc', () => {
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const tag = new Uint8Array(32).fill(7)

  it('parst Bucket mit Entry aus getDynamicFieldObject', async () => {
    const client = {
      getDynamicFieldObject: vi.fn().mockResolvedValue({
        data: {
          content: {
            fields: {
              entries: [
                {
                  fields: {
                    entry_id: '0',
                    ciphertext: [1, 2, 3],
                    iv: Array.from({ length: 12 }, (_, i) => i),
                    aes_tag: Array.from({ length: 16 }, () => 9),
                    delete_commit: Array.from({ length: 32 }, () => 8),
                    created_at_ms: '1700000000000',
                    expires_at_ms: '1700000000000',
                  },
                },
              ],
              next_entry_id: '1',
            },
          },
        },
      }),
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
    expect(client.getDynamicFieldObject).toHaveBeenCalledWith(
      expect.objectContaining({
        parentObjectId: mb,
        name: expect.objectContaining({
          type: `${pkg}::messaging::StealthSlotKey`,
          value: { tag: Array.from(tag) },
        }),
      })
    )
  })

  it('überspringt fehlende Buckets', async () => {
    const client = {
      getDynamicFieldObject: vi.fn().mockResolvedValue({ data: { error: { code: 'notFound' } } }),
    }
    const buckets = await fetchStealthBucketsForSlotTags(client as never, {
      mailboxObjectId: mb,
      callPackageId: pkg,
      slotTags: [tag],
    })
    expect(buckets).toEqual([])
  })
})
