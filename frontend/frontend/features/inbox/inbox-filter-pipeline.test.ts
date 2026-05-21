import { describe, it, expect } from 'vitest'
import { mapInboxApiRowsToMessages } from '@/frontend/features/inbox/inbox-map-messages'
import { filterInboxMessagesByPartnerAndDirection } from '@/frontend/features/inbox/inbox-partner-filter'
import { messageMatchesInboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'

const MY =
  '0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5'

describe('inbox filter pipeline (live API shape)', () => {
  it('encrypted rows survive default filters', () => {
    const apiRows: InboxApiRow[] = [
      {
        sender: MY,
        recipient: MY,
        text: 'ffg',
        isPlain: false,
        nonce: '1',
        ts: 1779218541318,
        chainPurgeable: true,
      },
      {
        sender: '0x0748329ee31e0000000000000000000000000000000000000000000000000095c5',
        recipient: MY,
        text: '[Verschlüsselt] Kein Handshake mit Absender 0x0748329ee31e…',
        isPlain: false,
        nonce: '99',
        ts: 1779000000000,
        chainPurgeable: false,
      },
      { sender: MY, text: 'plain event', isPlain: true, nonce: '2', ts: 1779292277394 },
    ]
    const mapped = mapInboxApiRowsToMessages(apiRows)
    const enc = mapped.filter((m) => m.encrypted)
    expect(enc.length).toBe(2)

    const afterPartner = filterInboxMessagesByPartnerAndDirection(mapped, MY, null, 'all')
    expect(afterPartner.filter((m) => m.encrypted).length).toBe(2)

    const afterWire = afterPartner.filter((m) => messageMatchesInboxWireFilter(m, 'all'))
    expect(afterWire.filter((m) => m.encrypted).length).toBe(2)

    const plaintextOnly = afterPartner.filter((m) => messageMatchesInboxWireFilter(m, 'plaintext'))
    expect(plaintextOnly.filter((m) => m.encrypted).length).toBe(0)
  })
})
