import { describe, expect, it, vi } from 'vitest'
import type { IotaClient } from '@iota/iota-sdk/client'
import {
  coerceMoveU8Vector,
  fetchPlaintextMailboxInboxRows,
  messagingStructType,
  normalizeMailboxAddress,
} from './mailbox-inbox-plain-rpc'

describe('mailbox-inbox-plain-rpc', () => {
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const me = '0x' + '33'.repeat(32)
  const peer = '0x' + '44'.repeat(32)

  it('messagingStructType', () => {
    expect(messagingStructType(pkg, 'PlainMsgKey')).toBe(`${pkg}::messaging::PlainMsgKey`)
    expect(messagingStructType(pkg, 'MsgKey')).toBe(`${pkg}::messaging::MsgKey`)
  })

  it('normalizeMailboxAddress', () => {
    expect(normalizeMailboxAddress(me.toUpperCase())).toBe(me)
  })

  it('coerceMoveU8Vector aus Zahlenarray', () => {
    const u = coerceMoveU8Vector([72, 105])
    expect(new TextDecoder().decode(u)).toBe('Hi')
  })

  it('fetchPlaintextMailboxInboxRows: ein Klartext-Eintrag (incoming)', async () => {
    const plainType = `${pkg}::messaging::PlainMsgKey`
    const objId = '0x' + '55'.repeat(32)
    const textBytes = new TextEncoder().encode('Hallo')
    const client = {
      getDynamicFields: vi.fn().mockResolvedValue({
        data: [
          {
            objectId: objId,
            name: {
              type: plainType,
              value: { recipient: me, sender: peer, nonce: '7' },
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
                sender: peer,
                recipient: me,
                text: [...textBytes],
                nonce: '7',
                created_at_ms: '1700000000000',
                expires_at_ms: '0',
              },
            },
          },
        },
      ]),
    } as unknown as IotaClient

    const rows = await fetchPlaintextMailboxInboxRows(client, {
      mailboxObjectId: mb,
      packageId: pkg,
      myAddress: me,
      limit: 10,
      offset: 0,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.text).toBe('Hallo')
    expect(rows[0]?.sender).toBe(peer)
    expect(rows[0]?.recipient).toBe(me)
    expect(rows[0]?.chainPurgeable).toBe(true)
  })
})
