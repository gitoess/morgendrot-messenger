import { Transaction } from '@iota/iota-sdk/transactions'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

function hexToBytes32(hex: string, label: string): Uint8Array {
  const h = hex.trim().replace(/^0x/i, '')
  if (!/^[a-fA-F0-9]{64}$/.test(h)) {
    throw new Error(`Ungültige 32-Byte-Hex (${label}).`)
  }
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return out
}

export type EinsatzManifestSourceNetworkU8 = 0 | 1

export type BuildStoreEinsatzManifestTxInput = {
  packageId: string
  registryObjectId: string
  senderAddress: string
  /** Move-`address` (32 B) — z. B. SHA-256(Einsatz-ID). */
  einsatzIdMoveAddress: string
  sequence: bigint
  manifestHashHex: string
  merkleRootHex: string
  sourceNetwork: EinsatzManifestSourceNetworkU8
  sourcePackageId: string
  periodStartMs: bigint
  periodEndMs: bigint
  messageCount: bigint
  manifestUriHashHex?: string
}

/** PTB: `messaging::store_einsatz_manifest` (§ H.33). */
export function buildStoreEinsatzManifestTransaction(input: BuildStoreEinsatzManifestTxInput): Transaction {
  const pkg = input.packageId.trim()
  const reg = input.registryObjectId.trim()
  const sender = input.senderAddress.trim()
  const einsatzAddr = input.einsatzIdMoveAddress.trim()
  for (const [label, a] of [
    ['PACKAGE_ID', pkg],
    ['registry', reg],
    ['sender', sender],
    ['einsatzId', einsatzAddr],
    ['sourcePackageId', input.sourcePackageId.trim()],
  ] as const) {
    if (!HEX64.test(a)) throw new Error(`Ungültige Objekt-/Adress-ID (${label}).`)
  }
  const manifestHash = hexToBytes32(input.manifestHashHex, 'manifest_hash')
  const merkleRoot = hexToBytes32(input.merkleRootHex, 'merkle_root')
  const sourcePkgBytes = hexToBytes32(input.sourcePackageId, 'source_package_id')
  const uriRaw = (input.manifestUriHashHex ?? '').trim()
  const manifestUriHash = uriRaw ? hexToBytes32(uriRaw, 'manifest_uri_hash') : new Uint8Array(0)

  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::messaging::store_einsatz_manifest`,
    arguments: [
      txb.object(reg),
      txb.pure.address(einsatzAddr),
      txb.pure.u64(input.sequence),
      txb.pure.vector('u8', Array.from(manifestHash)),
      txb.pure.vector('u8', Array.from(merkleRoot)),
      txb.pure.u8(input.sourceNetwork),
      txb.pure.vector('u8', Array.from(sourcePkgBytes)),
      txb.pure.u64(input.periodStartMs),
      txb.pure.u64(input.periodEndMs),
      txb.pure.u64(input.messageCount),
      txb.pure.vector('u8', Array.from(manifestUriHash)),
    ],
  })
  return txb
}
