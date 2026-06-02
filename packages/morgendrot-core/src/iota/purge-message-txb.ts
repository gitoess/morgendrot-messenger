import { Transaction } from '@iota/iota-sdk/transactions'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type PurgeMailboxMessageVariant = 'encrypted' | 'plaintext'

export type BuildPurgeMailboxMessageTxInput = {
  packageId: string
  senderAddress: string
  mailboxObjectId: string
  recipient: string
  peerSender: string
  nonce: bigint
  variant: PurgeMailboxMessageVariant
  privateMailbox?: boolean
}

/** PTB: `purge_message` / `purge_plaintext_mail_entry` (+ `_private`). */
export function buildPurgeMailboxMessageTransaction(input: BuildPurgeMailboxMessageTxInput): Transaction {
  const pkg = input.packageId.trim()
  const sender = input.senderAddress.trim()
  const mb = input.mailboxObjectId.trim()
  const recipient = input.recipient.trim()
  const peer = input.peerSender.trim()
  for (const [label, a] of [
    ['PACKAGE_ID', pkg],
    ['sender', sender],
    ['mailbox', mb],
    ['recipient', recipient],
    ['peerSender', peer],
  ] as const) {
    if (!HEX64.test(a)) throw new Error(`Ungültige Adresse (${label}).`)
  }
  const txb = new Transaction()
  txb.setSender(sender)
  const base =
    input.variant === 'plaintext' ? 'purge_plaintext_mail_entry' : 'purge_message'
  const fn = input.privateMailbox ? `${base}_private` : base
  txb.moveCall({
    target: `${pkg}::messaging::${fn}`,
    arguments: [
      txb.object(mb),
      txb.pure.address(recipient),
      txb.pure.address(peer),
      txb.pure.u64(input.nonce),
    ],
  })
  return txb
}
