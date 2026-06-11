import { Transaction } from '@iota/iota-sdk/transactions'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type BuildPurgeTeamPlaintextBroadcastTxInput = {
  packageId: string
  senderAddress: string
  teamMailboxObjectId: string
  /** Original-Sender der Broadcast-Nachricht (TeamPlainBroadcastKey.sender). */
  broadcastSender: string
  nonce: bigint
}

/** PTB: `messaging::purge_team_plaintext_broadcast` — Shared Team-Mailbox. */
export function buildPurgeTeamPlaintextBroadcastTransaction(
  input: BuildPurgeTeamPlaintextBroadcastTxInput
): Transaction {
  const pkg = input.packageId.trim()
  const signer = input.senderAddress.trim()
  const teamMb = input.teamMailboxObjectId.trim()
  const broadcastSender = input.broadcastSender.trim()
  for (const [label, a] of [
    ['PACKAGE_ID', pkg],
    ['signer', signer],
    ['teamMailbox', teamMb],
    ['broadcastSender', broadcastSender],
  ] as const) {
    if (!HEX64.test(a)) throw new Error(`Ungültige Adresse/Objekt-ID (${label}).`)
  }
  if (pkg.toLowerCase() === teamMb.toLowerCase()) {
    throw new Error('Team-Mailbox-ID darf nicht gleich PACKAGE_ID sein.')
  }
  const txb = new Transaction()
  txb.setSender(signer)
  txb.moveCall({
    target: `${pkg}::messaging::purge_team_plaintext_broadcast`,
    arguments: [txb.object(teamMb), txb.pure.address(broadcastSender), txb.pure.u64(input.nonce)],
  })
  return txb
}
