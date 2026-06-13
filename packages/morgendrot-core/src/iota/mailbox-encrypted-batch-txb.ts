import { Transaction } from '@iota/iota-sdk/transactions'
import { bcs } from '@iota/iota-sdk/bcs'
import {
  DIRECT_MAILBOX_MAX_CIPHER_U8,
  type BuildStoreEncryptedMailboxTxInput,
} from './mailbox-encrypted-txb'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type EncryptedMailboxBatchItem = {
  ciphertext: Uint8Array
  iv: Uint8Array
  tag: Uint8Array
  nonce: bigint
}

export type BuildStoreEncryptedMailboxBatchTxInput = Omit<
  BuildStoreEncryptedMailboxTxInput,
  'ciphertext' | 'iv' | 'tag' | 'nonce'
> & {
  items: readonly EncryptedMailboxBatchItem[]
}

function assertCipherFields(item: EncryptedMailboxBatchItem, label: string): void {
  for (const [name, u8] of [
    ['ciphertext', item.ciphertext],
    ['iv', item.iv],
    ['tag', item.tag],
  ] as const) {
    if (u8.length > DIRECT_MAILBOX_MAX_CIPHER_U8) {
      throw new Error(`${label}.${name}: vector<u8> max. ${DIRECT_MAILBOX_MAX_CIPHER_U8} B.`)
    }
  }
  if (item.iv.length !== 12) throw new Error(`${label}.iv: AES-GCM IV muss 12 Byte haben.`)
  if (item.tag.length !== 16) throw new Error(`${label}.tag: AES-GCM Tag muss 16 Byte haben.`)
  if (item.ciphertext.length === 0) throw new Error(`${label}.ciphertext: darf nicht leer sein.`)
}

/** PTB: mehrere `store_encrypted_message*` in einer Transaktion (§ H.33e). */
export function buildStoreEncryptedMailboxBatchTransaction(
  input: BuildStoreEncryptedMailboxBatchTxInput
): Transaction {
  const pkg = input.packageId.trim()
  const mb = input.mailboxObjectId.trim()
  const sender = input.senderAddress.trim()
  const recipient = input.recipientAddress.trim()
  for (const [label, a] of [
    ['PACKAGE_ID', pkg],
    ['MAILBOX_ID', mb],
    ['sender', sender],
    ['recipient', recipient],
  ] as const) {
    if (!HEX64.test(a)) throw new Error(`Ungültige Adresse/Objekt-ID (${label}).`)
  }
  if (pkg.toLowerCase() === mb.toLowerCase()) {
    throw new Error('MAILBOX_ID darf nicht gleich PACKAGE_ID sein (Move verbietet Package als Objekt).')
  }
  if (!input.items.length) throw new Error('Mindestens ein Batch-Eintrag nötig.')
  if (input.items.length > 50) throw new Error('Max. 50 Nachrichten pro Batch-TX.')

  const storeFn = input.privateMailbox ? 'store_encrypted_message_private' : 'store_encrypted_message'
  const txb = new Transaction()
  txb.setSender(sender)
  input.items.forEach((item, i) => {
    assertCipherFields(item, `items[${i}]`)
    txb.moveCall({
      target: `${pkg}::messaging::${storeFn}`,
      arguments: [
        txb.object(mb),
        txb.pure.address(recipient),
        txb.pure(bcs.vector(bcs.u8()).serialize(item.ciphertext)),
        txb.pure(bcs.vector(bcs.u8()).serialize(item.iv)),
        txb.pure(bcs.vector(bcs.u8()).serialize(item.tag)),
        txb.pure.u64(item.nonce),
        txb.pure.u64(input.ttlDays),
      ],
    })
  })
  return txb
}
