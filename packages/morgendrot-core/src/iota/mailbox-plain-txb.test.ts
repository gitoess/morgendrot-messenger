import { describe, expect, it } from 'vitest'
import {
  buildSendPlaintextEventTransaction,
  buildStorePlaintextMailboxTransaction,
} from './mailbox-plain-txb'

describe('buildSendPlaintextEventTransaction', () => {
  const pkg = '0x' + '11'.repeat(32)
  const sender = '0x' + '33'.repeat(32)
  const recipient = '0x' + '44'.repeat(32)

  it('baut Event-Transaction mit setSender', () => {
    const txb = buildSendPlaintextEventTransaction({
      packageId: pkg,
      senderAddress: sender,
      recipientAddress: recipient,
      plaintextUtf8: new TextEncoder().encode('hi'),
      nonce: 7n,
    })
    expect(txb).toBeTruthy()
  })
})

describe('buildStorePlaintextMailboxTransaction', () => {
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const sender = '0x' + '33'.repeat(32)
  const recipient = '0x' + '44'.repeat(32)

  it('baut Transaction mit setSender', () => {
    const txb = buildStorePlaintextMailboxTransaction({
      packageId: pkg,
      mailboxObjectId: mb,
      senderAddress: sender,
      recipientAddress: recipient,
      plaintextUtf8: new TextEncoder().encode('hi'),
      nonce: 7n,
      ttlDays: 30n,
    })
    expect(txb).toBeTruthy()
  })

  it('wirft bei MAILBOX_ID = PACKAGE_ID', () => {
    expect(() =>
      buildStorePlaintextMailboxTransaction({
        packageId: pkg,
        mailboxObjectId: pkg,
        senderAddress: sender,
        recipientAddress: recipient,
        plaintextUtf8: new Uint8Array([1]),
        nonce: 1n,
        ttlDays: 1n,
      })
    ).toThrow(/PACKAGE_ID/)
  })
})
