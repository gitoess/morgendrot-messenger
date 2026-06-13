import { describe, expect, it } from 'vitest'
import { buildSendEncryptedEventTransaction, buildStoreEncryptedMailboxTransaction } from './mailbox-encrypted-txb'

describe('buildStoreEncryptedMailboxTransaction', () => {
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const sender = '0x' + '33'.repeat(32)
  const recipient = '0x' + '44'.repeat(32)
  const iv = new Uint8Array(12).fill(1)
  const tag = new Uint8Array(16).fill(2)
  const ciphertext = new Uint8Array([3, 4, 5])

  it('baut Transaction mit setSender', () => {
    const txb = buildStoreEncryptedMailboxTransaction({
      packageId: pkg,
      mailboxObjectId: mb,
      senderAddress: sender,
      recipientAddress: recipient,
      ciphertext,
      iv,
      tag,
      nonce: 9n,
      ttlDays: 30n,
    })
    expect(txb).toBeTruthy()
  })

  it('wirft bei falscher IV-Länge', () => {
    expect(() =>
      buildStoreEncryptedMailboxTransaction({
        packageId: pkg,
        mailboxObjectId: mb,
        senderAddress: sender,
        recipientAddress: recipient,
        ciphertext,
        iv: new Uint8Array(11),
        tag,
        nonce: 1n,
        ttlDays: 1n,
      })
    ).toThrow(/12 Byte/)
  })

  it('wirft bei MAILBOX_ID = PACKAGE_ID', () => {
    expect(() =>
      buildStoreEncryptedMailboxTransaction({
        packageId: pkg,
        mailboxObjectId: pkg,
        senderAddress: sender,
        recipientAddress: recipient,
        ciphertext,
        iv,
        tag,
        nonce: 1n,
        ttlDays: 1n,
      })
    ).toThrow(/PACKAGE_ID/)
  })
})

describe('buildSendEncryptedEventTransaction', () => {
  const pkg = '0x' + '11'.repeat(32)
  const sender = '0x' + '33'.repeat(32)
  const recipient = '0x' + '44'.repeat(32)
  const iv = new Uint8Array(12).fill(1)
  const tag = new Uint8Array(16).fill(2)
  const ciphertext = new Uint8Array([3, 4, 5])

  it('baut Event-Transaction mit setSender', () => {
    const txb = buildSendEncryptedEventTransaction({
      packageId: pkg,
      senderAddress: sender,
      recipientAddress: recipient,
      ciphertext,
      iv,
      tag,
      nonce: 9n,
    })
    expect(txb).toBeTruthy()
  })
})
