import { describe, expect, it, vi } from 'vitest'
import type { IotaClient } from '@iota/iota-sdk/client'
import { fetchMailboxInboxRpcRows } from './mailbox-inbox-mixed-rpc'

describe('mailbox-inbox-mixed-rpc', () => {
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const me = '0x' + '33'.repeat(32)
  const peer = '0x' + '44'.repeat(32)

  it('fetchMailboxInboxRpcRows: Klartext + verschlüsselt, Sortierung nach ts absteigend', async () => {
    const plainType = `${pkg}::messaging::PlainMsgKey`
    const msgType = `${pkg}::messaging::MsgKey`
    const plainId = '0x' + '55'.repeat(32)
    const encId = '0x' + '66'.repeat(32)
    const textBytes = new TextEncoder().encode('Hi')
    const iv = new Uint8Array(12)
    iv.fill(1)
    const cipher = new Uint8Array([1, 2, 3])
    const tag = new Uint8Array(16)
    tag.fill(9)

    const client = {
      getDynamicFields: vi.fn().mockResolvedValue({
        data: [
          {
            objectId: plainId,
            name: {
              type: plainType,
              value: { recipient: me, sender: peer, nonce: '1' },
            },
          },
          {
            objectId: encId,
            name: {
              type: msgType,
              value: { recipient: me, sender: peer, nonce: '2' },
            },
          },
        ],
        hasNextPage: false,
      }),
      multiGetObjects: vi.fn().mockImplementation(({ ids }: { ids: string[] }) => {
        return ids.map((id) => {
          if (id === plainId) {
            return {
              data: {
                content: {
                  fields: {
                    sender: peer,
                    recipient: me,
                    text: [...textBytes],
                    nonce: '1',
                    created_at_ms: '1000',
                    expires_at_ms: '0',
                  },
                },
              },
            }
          }
          return {
            data: {
              content: {
                fields: {
                  sender: peer,
                  recipient: me,
                  nonce: '2',
                  iv: [...iv],
                  ciphertext: [...cipher],
                  tag: [...tag],
                  created_at_ms: '2000',
                  expires_at_ms: '0',
                },
              },
            },
          }
        })
      }),
    } as unknown as IotaClient

    const rows = await fetchMailboxInboxRpcRows(client, {
      mailboxObjectId: mb,
      packageId: pkg,
      myAddress: me,
      includePlaintext: true,
      includeEncrypted: true,
      limit: 10,
      offset: 0,
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]?.kind).toBe('encrypted')
    expect(rows[0]?.nonce).toBe('2')
    expect(rows[1]?.kind).toBe('plain')
    expect(rows[1]?.kind === 'plain' && rows[1].text).toBe('Hi')
  })
})
