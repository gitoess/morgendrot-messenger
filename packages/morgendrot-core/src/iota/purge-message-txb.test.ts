import { describe, expect, it } from 'vitest'
import { buildPurgeMailboxMessageTransaction } from './purge-message-txb'

describe('buildPurgeMailboxMessageTransaction', () => {
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const me = '0x' + '33'.repeat(32)
  const peer = '0x' + '44'.repeat(32)

  it('baut purge_message', () => {
    expect(
      buildPurgeMailboxMessageTransaction({
        packageId: pkg,
        senderAddress: me,
        mailboxObjectId: mb,
        recipient: me,
        peerSender: peer,
        nonce: 1n,
        variant: 'encrypted',
      })
    ).toBeTruthy()
  })

  it('baut purge_plaintext_mail_entry_private', () => {
    expect(
      buildPurgeMailboxMessageTransaction({
        packageId: pkg,
        senderAddress: me,
        mailboxObjectId: mb,
        recipient: peer,
        peerSender: me,
        nonce: 2n,
        variant: 'plaintext',
        privateMailbox: true,
      })
    ).toBeTruthy()
  })
})
