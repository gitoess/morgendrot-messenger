import { describe, expect, it } from 'vitest'
import { buildStoreEncryptedMailboxBatchTransaction } from './mailbox-encrypted-batch-txb'

const PKG = '0x' + 'a'.repeat(64)
const MB = '0x' + 'b'.repeat(64)
const SENDER = '0x' + 'c'.repeat(64)
const RECIPIENT = '0x' + 'd'.repeat(64)

describe('buildStoreEncryptedMailboxBatchTransaction', () => {
  it('baut PTB mit zwei verschlüsselten Einträgen', () => {
    const tx = buildStoreEncryptedMailboxBatchTransaction({
      packageId: PKG,
      mailboxObjectId: MB,
      senderAddress: SENDER,
      recipientAddress: RECIPIENT,
      ttlDays: 30n,
      items: [
        {
          ciphertext: new Uint8Array([1, 2, 3]),
          iv: new Uint8Array(12),
          tag: new Uint8Array(16),
          nonce: 1n,
        },
        {
          ciphertext: new Uint8Array([4, 5]),
          iv: new Uint8Array(12),
          tag: new Uint8Array(16),
          nonce: 2n,
        },
      ],
    })
    expect(tx).toBeTruthy()
  })
})
