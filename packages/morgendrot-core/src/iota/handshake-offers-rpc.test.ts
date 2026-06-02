import { describe, expect, it, vi } from 'vitest'
import type { IotaClient } from '@iota/iota-sdk/client'
import {
  fetchHsKeyFromMailbox,
  findPeerHandshakeFromRpc,
  listIncomingHandshakeOffersRpc,
} from './handshake-offers-rpc'

describe('handshake-offers-rpc', () => {
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const me = '0x' + '33'.repeat(32)
  const peer = '0x' + '44'.repeat(32)
  const hsType = `${pkg}::messaging::HsKey`

  it('listIncomingHandshakeOffersRpc: HsKey in Mailbox + Event', async () => {
    const client = {
      getDynamicFields: vi.fn().mockResolvedValue({
        data: [
          {
            name: {
              type: hsType,
              value: { recipient: me, sender: peer },
            },
          },
        ],
        hasNextPage: false,
      }),
      getDynamicFieldObject: vi.fn().mockResolvedValue({
        data: {
          content: {
            fields: {
              pub_key: [1, 2, 3],
              nonce: '7',
            },
          },
        },
      }),
      queryEvents: vi.fn().mockResolvedValue({
        data: [
          {
            type: `${pkg}::messaging::EcdhInit`,
            parsedJson: { recipient: me, sender: '0x' + '55'.repeat(32), nonce: 3 },
          },
        ],
      }),
    } as unknown as IotaClient

    const offers = await listIncomingHandshakeOffersRpc(client, {
      packageId: pkg,
      myAddress: me,
      mailboxObjectIds: [mb],
      limit: 10,
    })
    expect(offers.length).toBeGreaterThanOrEqual(1)
    expect(offers.some((o) => o.sender.toLowerCase() === peer.toLowerCase() && o.nonce === '7')).toBe(true)
  })

  it('findPeerHandshakeFromRpc: liefert pub_key aus Mailbox', async () => {
    const client = {
      getDynamicFieldObject: vi.fn().mockResolvedValue({
        data: {
          content: {
            fields: {
              pub_key: [9, 9, 9],
              nonce: '1',
            },
          },
        },
      }),
      queryEvents: vi.fn().mockResolvedValue({ data: [] }),
    } as unknown as IotaClient

    const hs = await findPeerHandshakeFromRpc(client, {
      packageId: pkg,
      myAddress: me,
      peerAddress: peer,
      mailboxObjectIds: [mb],
    })
    expect(hs?.pubKeyRaw).toEqual(new Uint8Array([9, 9, 9]))
    expect(hs?.source).toBe('mailbox')
  })

  it('fetchHsKeyFromMailbox: ungültige Mailbox → null', async () => {
    const client = { getDynamicFieldObject: vi.fn() } as unknown as IotaClient
    const hs = await fetchHsKeyFromMailbox(client, {
      packageId: pkg,
      mailboxObjectId: 'bad',
      recipient: me,
      sender: peer,
    })
    expect(hs).toBeNull()
    expect(client.getDynamicFieldObject).not.toHaveBeenCalled()
  })
})
