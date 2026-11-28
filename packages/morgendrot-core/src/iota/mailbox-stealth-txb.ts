import { Transaction } from '@iota/iota-sdk/transactions'
import { bcs } from '@iota/iota-sdk/bcs'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

/** Pro `vector<u8>`-Argument — analog Encrypted-Mailbox. */
export const STEALTH_MAILBOX_MAX_PURE_U8 = 16384

export type BuildStoreStealthEntryTxInput = {
  /**
   * MoveCall-Target-Package (= **letztes Upgrade**, das `store_stealth_entry` exponiert).
   * Nicht zwingend Stamm-`PACKAGE_ID` der Mailbox-Typen.
   */
  callPackageId: string
  mailboxObjectId: string
  senderAddress: string
  /** 32 Byte `slot_tag` */
  slotTag: Uint8Array
  ciphertext: Uint8Array
  iv: Uint8Array
  /** AES-GCM Tag (16 B) */
  aesTag: Uint8Array
  /** 32 Byte `blake2b256(delete_secret || slot_tag)` */
  deleteCommit: Uint8Array
  ttlDays: bigint
}

export type BuildPurgeStealthEntryTxInput = {
  callPackageId: string
  mailboxObjectId: string
  senderAddress: string
  slotTag: Uint8Array
  entryId: bigint
  deleteSecret: Uint8Array
}

function assertHex(label: string, a: string) {
  if (!HEX64.test(a)) throw new Error(`Ungültige Adresse/Objekt-ID (${label}).`)
}

function assertU8(name: string, u8: Uint8Array, opts?: { exact?: number; min?: number }) {
  if (u8.length > STEALTH_MAILBOX_MAX_PURE_U8) {
    throw new Error(`${name}: vector<u8> max. ${STEALTH_MAILBOX_MAX_PURE_U8} B (Move pure).`)
  }
  if (opts?.exact !== undefined && u8.length !== opts.exact) {
    throw new Error(`${name} muss ${opts.exact} Byte haben.`)
  }
  if (opts?.min !== undefined && u8.length < opts.min) {
    throw new Error(`${name} darf nicht leer sein.`)
  }
}

/** PTB: `messaging::store_stealth_entry` (Append in Epoch-Bucket). */
export function buildStoreStealthEntryTransaction(input: BuildStoreStealthEntryTxInput): Transaction {
  const pkg = input.callPackageId.trim()
  const mb = input.mailboxObjectId.trim()
  const sender = input.senderAddress.trim()
  assertHex('callPackageId', pkg)
  assertHex('MAILBOX_ID', mb)
  assertHex('sender', sender)
  if (pkg.toLowerCase() === mb.toLowerCase()) {
    throw new Error('MAILBOX_ID darf nicht gleich callPackageId sein.')
  }
  const slotTag = new Uint8Array(input.slotTag)
  const ciphertext = new Uint8Array(input.ciphertext)
  const iv = new Uint8Array(input.iv)
  const aesTag = new Uint8Array(input.aesTag)
  const deleteCommit = new Uint8Array(input.deleteCommit)
  assertU8('slotTag', slotTag, { exact: 32 })
  assertU8('ciphertext', ciphertext, { min: 1 })
  assertU8('iv', iv, { exact: 12 })
  assertU8('aesTag', aesTag, { exact: 16 })
  assertU8('deleteCommit', deleteCommit, { exact: 32 })

  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::messaging::store_stealth_entry`,
    arguments: [
      txb.object(mb),
      txb.pure(bcs.vector(bcs.u8()).serialize(slotTag)),
      txb.pure(bcs.vector(bcs.u8()).serialize(ciphertext)),
      txb.pure(bcs.vector(bcs.u8()).serialize(iv)),
      txb.pure(bcs.vector(bcs.u8()).serialize(aesTag)),
      txb.pure(bcs.vector(bcs.u8()).serialize(deleteCommit)),
      txb.pure.u64(input.ttlDays),
    ],
  })
  return txb
}

/** PTB: `messaging::purge_stealth_entry`. */
export function buildPurgeStealthEntryTransaction(input: BuildPurgeStealthEntryTxInput): Transaction {
  const pkg = input.callPackageId.trim()
  const mb = input.mailboxObjectId.trim()
  const sender = input.senderAddress.trim()
  assertHex('callPackageId', pkg)
  assertHex('MAILBOX_ID', mb)
  assertHex('sender', sender)
  const slotTag = new Uint8Array(input.slotTag)
  const deleteSecret = new Uint8Array(input.deleteSecret)
  assertU8('slotTag', slotTag, { exact: 32 })
  assertU8('deleteSecret', deleteSecret, { min: 1 })

  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::messaging::purge_stealth_entry`,
    arguments: [
      txb.object(mb),
      txb.pure(bcs.vector(bcs.u8()).serialize(slotTag)),
      txb.pure.u64(input.entryId),
      txb.pure(bcs.vector(bcs.u8()).serialize(deleteSecret)),
    ],
  })
  return txb
}
