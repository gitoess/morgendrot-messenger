import { Transaction } from '@iota/iota-sdk/transactions'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type BuildPurgeHandshakeTxInput = {
  packageId: string
  senderAddress: string
  mailboxObjectId: string
  recipient: string
  /** HsKey-`sender` (Peer). */
  peerSender: string
  privateMailbox?: boolean
}

/** PTB: `purge_handshake` / `purge_handshake_private`. */
export function buildPurgeHandshakeTransaction(input: BuildPurgeHandshakeTxInput): Transaction {
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
  if (pkg.toLowerCase() === mb.toLowerCase()) {
    throw new Error('MAILBOX_ID darf nicht gleich PACKAGE_ID sein.')
  }
  const txb = new Transaction()
  txb.setSender(sender)
  const fn = input.privateMailbox ? 'purge_handshake_private' : 'purge_handshake'
  txb.moveCall({
    target: `${pkg}::messaging::${fn}`,
    arguments: [txb.object(mb), txb.pure.address(recipient), txb.pure.address(peer)],
  })
  return txb
}
