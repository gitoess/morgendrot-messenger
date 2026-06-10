import { Transaction } from '@iota/iota-sdk/transactions'
import { bcs } from '@iota/iota-sdk/bcs'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type BuildStoreTeamPlaintextBroadcastTxInput = {
  packageId: string
  teamMailboxObjectId: string
  senderAddress: string
  plaintextUtf8: Uint8Array
  nonce: bigint
  ttlDays: bigint
}

/**
 * PTB: `messaging::store_team_plaintext_broadcast` — 1× Fee pro Gruppennachricht (kein recipient).
 */
export function buildStoreTeamPlaintextBroadcastTransaction(
  input: BuildStoreTeamPlaintextBroadcastTxInput
): Transaction {
  const pkg = input.packageId.trim()
  const mb = input.teamMailboxObjectId.trim()
  const sender = input.senderAddress.trim()
  for (const [label, a] of [
    ['PACKAGE_ID', pkg],
    ['TEAM_MAILBOX_ID', mb],
    ['sender', sender],
  ] as const) {
    if (!HEX64.test(a)) throw new Error(`Ungültige Adresse/Objekt-ID (${label}).`)
  }
  if (pkg.toLowerCase() === mb.toLowerCase()) {
    throw new Error('TEAM_MAILBOX_ID darf nicht gleich PACKAGE_ID sein.')
  }
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::messaging::store_team_plaintext_broadcast`,
    arguments: [
      txb.object(mb),
      txb.pure(bcs.vector(bcs.u8()).serialize(input.plaintextUtf8)),
      txb.pure.u64(input.nonce),
      txb.pure.u64(input.ttlDays),
    ],
  })
  return txb
}
