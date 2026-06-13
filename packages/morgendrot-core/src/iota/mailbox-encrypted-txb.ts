import { Transaction } from '@iota/iota-sdk/transactions'
import { bcs } from '@iota/iota-sdk/bcs'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

/** Pro `vector<u8>`-Argument (Move pure) — konsistent mit Server `MESSENGER_MAX_PURE_VECTOR_U8_BYTES` (Default 16384). */
export const DIRECT_MAILBOX_MAX_CIPHER_U8 = 16384

export type BuildStoreEncryptedMailboxTxInput = {
  packageId: string
  mailboxObjectId: string
  senderAddress: string
  recipientAddress: string
  ciphertext: Uint8Array
  iv: Uint8Array
  tag: Uint8Array
  nonce: bigint
  ttlDays: bigint
  /** M4d: `store_encrypted_message_private` statt Shared-Mailbox. */
  privateMailbox?: boolean
}

/**
 * PTB: `messaging::store_encrypted_message` (Mailbox, **ohne** Credits).
 * Credits-Pfad (`store_encrypted_message_with_credits`) ist separat — braucht Credits-Objekt-ID.
 */
export function buildStoreEncryptedMailboxTransaction(input: BuildStoreEncryptedMailboxTxInput): Transaction {
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
  const { ciphertext, iv, tag } = input
  for (const [name, u8] of [
    ['ciphertext', ciphertext],
    ['iv', iv],
    ['tag', tag],
  ] as const) {
    if (u8.length > DIRECT_MAILBOX_MAX_CIPHER_U8) {
      throw new Error(`${name}: vector<u8> max. ${DIRECT_MAILBOX_MAX_CIPHER_U8} B (Move pure).`)
    }
  }
  if (iv.length !== 12) throw new Error('AES-GCM IV muss 12 Byte haben.')
  if (tag.length !== 16) throw new Error('AES-GCM Tag muss 16 Byte haben.')
  if (ciphertext.length === 0) throw new Error('Ciphertext darf nicht leer sein.')

  const storeFn = input.privateMailbox ? 'store_encrypted_message_private' : 'store_encrypted_message'
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::messaging::${storeFn}`,
    arguments: [
      txb.object(mb),
      txb.pure.address(recipient),
      txb.pure(bcs.vector(bcs.u8()).serialize(ciphertext)),
      txb.pure(bcs.vector(bcs.u8()).serialize(iv)),
      txb.pure(bcs.vector(bcs.u8()).serialize(tag)),
      txb.pure.u64(input.nonce),
      txb.pure.u64(input.ttlDays),
    ],
  })
  return txb
}

/** Verschlüsseltes Event (`send_encrypted_message`) — kein Mailbox-Objekt, flüchtig. */
export function buildSendEncryptedEventTransaction(params: {
  packageId: string
  senderAddress: string
  recipientAddress: string
  ciphertext: Uint8Array
  iv: Uint8Array
  tag: Uint8Array
  nonce: bigint
}): Transaction {
  const { packageId, senderAddress, recipientAddress, ciphertext, iv, tag, nonce } = params
  if (iv.length !== 12) throw new Error('IV muss 12 Bytes sein (AES-GCM).')
  if (tag.length !== 16) throw new Error('Tag muss 16 Bytes sein (AES-GCM).')
  const txb = new Transaction()
  txb.setSender(senderAddress)
  txb.moveCall({
    target: `${packageId}::messaging::send_encrypted_message`,
    arguments: [
      txb.pure.address(recipientAddress),
      txb.pure(bcs.vector(bcs.u8()).serialize(ciphertext)),
      txb.pure(bcs.vector(bcs.u8()).serialize(iv)),
      txb.pure(bcs.vector(bcs.u8()).serialize(tag)),
      txb.pure.u64(nonce),
    ],
  })
  return txb
}
