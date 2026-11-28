import { describe, expect, it } from 'vitest'
import { buildPurgeStealthEntryTransaction, buildStoreStealthEntryTransaction } from './mailbox-stealth-txb'

describe('mailbox-stealth-txb', () => {
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const sender = '0x' + '33'.repeat(32)
  const slotTag = new Uint8Array(32).fill(7)
  const deleteCommit = new Uint8Array(32).fill(8)
  const iv = new Uint8Array(12).fill(1)
  const aesTag = new Uint8Array(16).fill(2)
  const ciphertext = new Uint8Array([3, 4, 5])

  it('buildStoreStealthEntryTransaction setzt Sender', () => {
    const txb = buildStoreStealthEntryTransaction({
      callPackageId: pkg,
      mailboxObjectId: mb,
      senderAddress: sender,
      slotTag,
      ciphertext,
      iv,
      aesTag,
      deleteCommit,
      ttlDays: 7n,
    })
    expect(txb).toBeTruthy()
  })

  it('store wirft bei slotTag ≠ 32', () => {
    expect(() =>
      buildStoreStealthEntryTransaction({
        callPackageId: pkg,
        mailboxObjectId: mb,
        senderAddress: sender,
        slotTag: new Uint8Array(31),
        ciphertext,
        iv,
        aesTag,
        deleteCommit,
        ttlDays: 1n,
      })
    ).toThrow(/32 Byte/)
  })

  it('buildPurgeStealthEntryTransaction ok', () => {
    const txb = buildPurgeStealthEntryTransaction({
      callPackageId: pkg,
      mailboxObjectId: mb,
      senderAddress: sender,
      slotTag,
      entryId: 0n,
      deleteSecret: new Uint8Array([1, 2, 3]),
    })
    expect(txb).toBeTruthy()
  })
})
