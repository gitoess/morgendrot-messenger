import { Transaction } from '@iota/iota-sdk/transactions'
import { bcs } from '@iota/iota-sdk/bcs'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type BuildStorePlaintextMailboxTxInput = {
  packageId: string
  mailboxObjectId: string
  senderAddress: string
  recipientAddress: string
  plaintextUtf8: Uint8Array
  nonce: bigint
  ttlDays: bigint
  /** M4d: `store_plaintext_message_stored_private` statt Shared-Mailbox. */
  privateMailbox?: boolean
  /** Persistent (DF) statt nur Event — Shared: `store_plaintext_message_stored`. */
  stored?: boolean
}

export type BuildSendPlaintextEventTxInput = {
  packageId: string
  senderAddress: string
  recipientAddress: string
  plaintextUtf8: Uint8Array
  nonce: bigint
}

/**
 * PTB: `messaging::send_plaintext_message` — flüchtiges Event, **ohne** Mailbox-Objekt.
 */
export function buildSendPlaintextEventTransaction(input: BuildSendPlaintextEventTxInput): Transaction {
  const pkg = input.packageId.trim()
  const sender = input.senderAddress.trim()
  const recipient = input.recipientAddress.trim()
  for (const [label, a] of [
    ['PACKAGE_ID', pkg],
    ['sender', sender],
    ['recipient', recipient],
  ] as const) {
    if (!HEX64.test(a)) throw new Error(`Ungültige Adresse/Objekt-ID (${label}).`)
  }
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::messaging::send_plaintext_message`,
    arguments: [
      txb.pure.address(recipient),
      txb.pure(bcs.vector(bcs.u8()).serialize(input.plaintextUtf8)),
      txb.pure.u64(input.nonce),
    ],
  })
  return txb
}

/**
 * PTB: `messaging::store_plaintext_message` (Mailbox, **ohne** Credits).
 * Muss mit Server-Konfiguration übereinstimmen (Klartext in Mailbox, keine Credits auf diesem Pfad).
 */
export function buildStorePlaintextMailboxTransaction(input: BuildStorePlaintextMailboxTxInput): Transaction {
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
  const storeFn = input.privateMailbox
    ? input.stored
      ? 'store_plaintext_message_stored_private'
      : 'store_plaintext_message'
    : input.stored
      ? 'store_plaintext_message_stored'
      : 'store_plaintext_message'
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::messaging::${storeFn}`,
    arguments: [
      txb.object(mb),
      txb.pure.address(recipient),
      txb.pure(bcs.vector(bcs.u8()).serialize(input.plaintextUtf8)),
      txb.pure.u64(input.nonce),
      txb.pure.u64(input.ttlDays),
    ],
  })
  return txb
}

/** Objekt-ID (Mailbox, Package, …): 0x + 64 Hex. */
export function isLikelyIotaHexId(s: string): boolean {
  return HEX64.test(String(s || '').trim())
}
