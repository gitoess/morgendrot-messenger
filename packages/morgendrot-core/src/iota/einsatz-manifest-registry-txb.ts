import { Transaction } from '@iota/iota-sdk/transactions'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type BuildCreateEinsatzManifestRegistryTxInput = {
  packageId: string
  senderAddress: string
  authorizedAnchorer: string
}

/** PTB: `messaging::create_einsatz_manifest_registry` (§ H.33 Phase 2). */
export function buildCreateEinsatzManifestRegistryTransaction(
  input: BuildCreateEinsatzManifestRegistryTxInput
): Transaction {
  const pkg = input.packageId.trim()
  const sender = input.senderAddress.trim()
  const anchorer = input.authorizedAnchorer.trim()
  for (const [label, a] of [
    ['PACKAGE_ID', pkg],
    ['sender', sender],
    ['authorized_anchorer', anchorer],
  ] as const) {
    if (!HEX64.test(a)) throw new Error(`Ungültige Adress-ID (${label}).`)
  }
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::messaging::create_einsatz_manifest_registry`,
    arguments: [txb.pure.address(anchorer)],
  })
  return txb
}
