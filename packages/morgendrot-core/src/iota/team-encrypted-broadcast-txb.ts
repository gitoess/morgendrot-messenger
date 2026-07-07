import { Transaction } from '@iota/iota-sdk/transactions'
import { bcs } from '@iota/iota-sdk/bcs'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type BuildStoreTeamEncryptedBroadcastTxInput = {
  packageId: string
  teamMailboxObjectId: string
  senderAddress: string
  ciphertext: Uint8Array
  iv: Uint8Array
  tag: Uint8Array
  keyEpoch: bigint
  nonce: bigint
  ttlDays: bigint
}

/** PTB: `messaging::store_team_encrypted_broadcast` — 1× Fee pro verschlüsselter Gruppennachricht. */
export function buildStoreTeamEncryptedBroadcastTransaction(
  input: BuildStoreTeamEncryptedBroadcastTxInput
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
    target: `${pkg}::messaging::store_team_encrypted_broadcast`,
    arguments: [
      txb.object(mb),
      txb.pure(bcs.vector(bcs.u8()).serialize(input.ciphertext)),
      txb.pure(bcs.vector(bcs.u8()).serialize(input.iv)),
      txb.pure(bcs.vector(bcs.u8()).serialize(input.tag)),
      txb.pure.u64(input.keyEpoch),
      txb.pure.u64(input.nonce),
      txb.pure.u64(input.ttlDays),
    ],
  })
  return txb
}
