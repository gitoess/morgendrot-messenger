import { Transaction } from '@iota/iota-sdk/transactions'
import { bcs } from '@iota/iota-sdk/bcs'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type BuildStoreEcdhInitTxInput = {
  packageId: string
  senderAddress: string
  recipientAddress: string
  pubKeyRaw: Uint8Array
  nonce: bigint
  ttlDays: bigint
  /** Wenn gesetzt: Handshake in Mailbox (HsKey); sonst nur `emit_ecdh_init`. */
  mailboxObjectId?: string
  privateMailbox?: boolean
}

/**
 * PTB: `store_ecdh_init` / `store_ecdh_init_private` oder `emit_ecdh_init` (ohne Credits-Pfad).
 */
export function buildStoreEcdhInitTransaction(input: BuildStoreEcdhInitTxInput): Transaction {
  const pkg = input.packageId.trim()
  const sender = input.senderAddress.trim()
  const recipient = input.recipientAddress.trim()
  const pkLen = input.pubKeyRaw?.length ?? 0
  if (pkLen < 32 || pkLen > 160) {
    throw new Error(`ECDH-Public-Key ungültig (${pkLen} B). Erwartet typisch 65 B (P-256 uncompressed).`)
  }
  for (const [label, a] of [
    ['PACKAGE_ID', pkg],
    ['sender', sender],
    ['recipient', recipient],
  ] as const) {
    if (!HEX64.test(a)) throw new Error(`Ungültige Adresse (${label}).`)
  }
  const txb = new Transaction()
  txb.setSender(sender)
  const mb = (input.mailboxObjectId ?? '').trim()
  if (mb && HEX64.test(mb)) {
    if (pkg.toLowerCase() === mb.toLowerCase()) {
      throw new Error('MAILBOX_ID darf nicht gleich PACKAGE_ID sein.')
    }
    const fn = input.privateMailbox ? 'store_ecdh_init_private' : 'store_ecdh_init'
    txb.moveCall({
      target: `${pkg}::messaging::${fn}`,
      arguments: [
        txb.object(mb),
        txb.pure.address(recipient),
        txb.pure(bcs.vector(bcs.u8()).serialize(input.pubKeyRaw)),
        txb.pure.u64(input.nonce),
        txb.pure.u64(input.ttlDays),
      ],
    })
  } else {
    txb.moveCall({
      target: `${pkg}::messaging::emit_ecdh_init`,
      arguments: [
        txb.pure.address(recipient),
        txb.pure(bcs.vector(bcs.u8()).serialize(input.pubKeyRaw)),
        txb.pure.u64(input.nonce),
      ],
    })
  }
  return txb
}
