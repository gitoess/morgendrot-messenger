import { describe, expect, it } from 'vitest'
import { buildStorePlaintextMailboxBatchTransaction } from './mailbox-plain-batch-txb'

const PKG = '0x' + 'a'.repeat(64)
const MB = '0x' + 'b'.repeat(64)
const SENDER = '0x' + 'c'.repeat(64)
const RECIPIENT = '0x' + 'd'.repeat(64)

describe('buildStorePlaintextMailboxBatchTransaction', () => {
  it('baut PTB mit zwei Einträgen', () => {
    const tx = buildStorePlaintextMailboxBatchTransaction({
      packageId: PKG,
      mailboxObjectId: MB,
      senderAddress: SENDER,
      recipientAddress: RECIPIENT,
      ttlDays: 30n,
      stored: true,
      items: [
        { plaintextUtf8: new TextEncoder().encode('Hallo'), nonce: 1n },
        { plaintextUtf8: new TextEncoder().encode('Welt'), nonce: 2n },
      ],
    })
    expect(tx).toBeTruthy()
  })

  it('lehnt leere Liste ab', () => {
    expect(() =>
      buildStorePlaintextMailboxBatchTransaction({
        packageId: PKG,
        mailboxObjectId: MB,
        senderAddress: SENDER,
        recipientAddress: RECIPIENT,
        ttlDays: 30n,
        stored: true,
        items: [],
      })
    ).toThrow(/Mindestens ein/)
  })
})
