import { describe, expect, it, vi } from 'vitest'
import { fetchMessagingEventInboxRpcRows } from './messaging-events-inbox-rpc'

describe('fetchMessagingEventInboxRpcRows', () => {
  const pkg = '0x' + '11'.repeat(32)
  const me = '0x' + '22'.repeat(32)
  const peer = '0x' + '33'.repeat(32)

  it('sammelt PlaintextMessage- und EncryptedMessage-Events', async () => {
    const client = {
      queryEvents: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'ev1',
            type: `${pkg}::messaging::PlaintextMessage`,
            timestampMs: 1_700_000_000_000,
            parsedJson: {
              sender: peer,
              recipient: me,
              nonce: '42',
              text: [72, 105],
            },
          },
          {
            id: 'ev2',
            type: `${pkg}::messaging::EncryptedMessage`,
            timestampMs: 1_700_000_000_001,
            parsedJson: {
              sender: peer,
              recipient: me,
              nonce: '43',
              iv: Array.from({ length: 12 }, (_, i) => i),
              ciphertext: [1, 2, 3],
              tag: Array.from({ length: 16 }, () => 9),
            },
          },
        ],
        nextCursor: null,
      }),
    }

    const rows = await fetchMessagingEventInboxRpcRows(client as never, {
      packageId: pkg,
      myAddress: me,
      limit: 10,
      offset: 0,
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]?.kind).toBe('encrypted')
    expect(rows[1]?.kind).toBe('plain')
    if (rows[1]?.kind === 'plain') expect(rows[1].text).toBe('Hi')
  })
})
