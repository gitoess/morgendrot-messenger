import { Transaction } from '@iota/iota-sdk/transactions'
import { bcs } from '@iota/iota-sdk/bcs'
import type { BuildStorePlaintextMailboxTxInput } from './mailbox-plain-txb'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type PlaintextMailboxBatchItem = {
  plaintextUtf8: Uint8Array
  nonce: bigint
}

export type BuildStorePlaintextMailboxBatchTxInput = Omit<
  BuildStorePlaintextMailboxTxInput,
  'plaintextUtf8' | 'nonce'
> & {
  items: readonly PlaintextMailboxBatchItem[]
}

function resolveStorePlaintextFn(input: Pick<BuildStorePlaintextMailboxTxInput, 'privateMailbox' | 'stored'>): string {
  if (input.privateMailbox) {
    return input.stored ? 'store_plaintext_message_stored_private' : 'store_plaintext_message'
  }
  return input.stored ? 'store_plaintext_message_stored' : 'store_plaintext_message'
}

/**
 * PTB: mehrere `store_plaintext_message*` in **einer** Transaktion (§ H.33e Batch-Archiv).
 * Jeder Eintrag = eigener DF unter der Mailbox, gemeinsamer TX-Digest.
 */
export function buildStorePlaintextMailboxBatchTransaction(
  input: BuildStorePlaintextMailboxBatchTxInput
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

  const storeFn = resolveStorePlaintextFn(input)
  const txb = new Transaction()
  txb.setSender(sender)
  for (const item of input.items) {
    txb.moveCall({
      target: `${pkg}::messaging::${storeFn}`,
      arguments: [
        txb.object(mb),
        txb.pure.address(recipient),
        txb.pure(bcs.vector(bcs.u8()).serialize(item.plaintextUtf8)),
        txb.pure.u64(item.nonce),
        txb.pure.u64(input.ttlDays),
      ],
    })
  }
  return txb
}
