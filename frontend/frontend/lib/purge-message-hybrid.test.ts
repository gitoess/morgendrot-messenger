import { describe, expect, it } from 'vitest'
import { resolveMailboxPurgeAddresses } from './mailbox-purge-routing'
import type { Message } from '@/frontend/lib/types'

describe('purge-message-hybrid', () => {
  const me = '0x' + 'aa'.repeat(32)
  const peer = '0x' + 'bb'.repeat(32)

  it('eingehend: recipient=ich, sender=peer', () => {
    const msg: Message = {
      id: '1',
      from: peer,
      content: 'hi',
      timestamp: 1,
      recipient: me,
      chainNonce: '42',
      chainPurgeable: true,
    }
    expect(resolveMailboxPurgeAddresses(msg, me)).toEqual({
      recipient: me,
      peerSender: peer,
    })
  })

  it('ausgehend: recipient=peer, sender=ich', () => {
    const msg: Message = {
      id: '2',
      from: me,
      content: 'hi',
      timestamp: 1,
      recipient: peer,
      chainNonce: '43',
      chainPurgeable: true,
    }
    expect(resolveMailboxPurgeAddresses(msg, me)).toEqual({
      recipient: peer,
      peerSender: me,
    })
  })
})
