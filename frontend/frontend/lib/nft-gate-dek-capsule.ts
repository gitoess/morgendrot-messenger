/**
 * H.23 B2-P4a / P4a-dual / P4a2 — NFT-Gate (+ optional Wallet / Pubkey-Wrap).
 *
 * P4a: DEK via HKDF(nftId) — App-Gate ehrlich.
 * Dual: HKDF(nftId|wallet) + Signer-Check.
 * P4a2: DEK via ECDH(ephemeral → recipientPub) gebunden an nft+wallet —
 *        Wire allein reicht nicht; Privatkey der requiredWallet nötig.
 * P4b:  DEK via Broker-Seal-Key (HKDF master+identity); Wire allein reicht nicht.
 *
 * Spec: docs/NFT-SCHLUESSELKARTE-MODI.md §6a · docs/NFT-GATE-SEAL-P4B-SPEC.md
 */

import { deriveSharedSecret, generateKeyPair } from '@morgendrot/shared/morgendrot-crypto'

const PREFIX = 'MORG_NFTGATE_V1:'
const MAGIC = 'MORGNFTG1'
const SCHEMA = 'morgendrot.nftgate.msg.v1' as const
const WRAP_INFO = new TextEncoder().encode('morgendrot-nftgate-wrap-v1')
const SALT_BYTES = 16
const IV_BYTES = 12
const DEK_BYTES = 32
const P256_RAW_PUB_LEN = 65
const HEX64 = /^0x[a-f0-9]{64}$/

export const NFT_GATE_WIRE_PREFIX = PREFIX
export const NFT_GATE_SCHEMA = SCHEMA

export type NftGateMode =
  | 'nft_owner_p4a'
  | 'nft_and_wallet_p4a'
  | 'nft_and_wallet_pubkey_p4a2'
  | 'nft_seal_p4b'

export type NftGateMetaV1 = {
  schema: typeof SCHEMA
  gate: NftGateMode
  nftObjectId: string
  /** Dual / P4a2 / optional P4b Dual-Policy — Signer muss diese Adresse sein. */
  requiredWallet?: string
  /** P4a2: ephemeral P-256 uncompressed pub (65 B) base64. */
  ephemeralPubRawB64?: string
  /** P4b: Policy-Hinweis für Broker. */
  sealPolicy?: 'nft_owner' | 'nft_and_wallet'
  algo: 'AES-256-GCM'
  bodyIvB64: string
  wrapSaltB64: string
  wrapIvB64: string
  wrappedDekB64: string
}

function bytesToB64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!)
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function normHex(id: string): string {
  return id.trim().toLowerCase()
}

function getSubtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('Web Crypto fehlt (crypto.subtle).')
  return s
}

function buf(u: Uint8Array): Parameters<SubtleCrypto['importKey']>[1] {
  return u as Parameters<SubtleCrypto['importKey']>[1]
}

function gateInfoTail(nftObjectId: string, requiredWallet?: string | null): Uint8Array {
  const nft = normHex(nftObjectId)
  return requiredWallet
    ? new TextEncoder().encode(`${nft}|w|${normHex(requiredWallet)}`)
    : new TextEncoder().encode(nft)
}

/** P4a / Dual: Wrap-Key nur aus Salt + öffentlichen IDs (kein Geheimnis). */
async function deriveHkdfWrapKey(
  wrapSalt: Uint8Array,
  nftObjectId: string,
  requiredWallet?: string | null
): Promise<CryptoKey> {
  const subtle = getSubtle()
  const tail = gateInfoTail(nftObjectId, requiredWallet)
  const info = new Uint8Array(WRAP_INFO.length + tail.length)
  info.set(WRAP_INFO, 0)
  info.set(tail, WRAP_INFO.length)
  const ikm = await subtle.importKey('raw', buf(wrapSalt), 'HKDF', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** P4a2: Wrap-Key aus ECDH-Shared + nft|wallet + salt. */
async function deriveEcdhWrapKey(
  sharedSecret: Uint8Array,
  wrapSalt: Uint8Array,
  nftObjectId: string,
  requiredWallet: string
): Promise<CryptoKey> {
  const subtle = getSubtle()
  const tail = gateInfoTail(nftObjectId, requiredWallet)
  const info = new Uint8Array(WRAP_INFO.length + tail.length + wrapSalt.length)
  info.set(WRAP_INFO, 0)
  info.set(tail, WRAP_INFO.length)
  info.set(wrapSalt, WRAP_INFO.length + tail.length)
  const ikm = await subtle.importKey('raw', buf(sharedSecret), 'HKDF', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export function isNftGateMessageWire(content: string): boolean {
  return content.trimStart().startsWith(PREFIX)
}

export function peekNftGateObjectId(content: string): string | null {
  try {
    return parseNftGateBlob(content.trim()).meta.nftObjectId
  } catch {
    return null
  }
}

export function peekNftGateMeta(content: string): NftGateMetaV1 | null {
  try {
    return parseNftGateBlob(content.trim()).meta
  } catch {
    return null
  }
}

/** App-Vorcheck: NFT-Leserecht + ggf. Wallet-Bindung. */
export function evaluateNftGateAccess(opts: {
  meta: Pick<NftGateMetaV1, 'gate' | 'requiredWallet'>
  nftAccessOk: boolean
  signerAddress: string | null | undefined
}): { ok: true } | { ok: false; error: string } {
  if (!opts.nftAccessOk) {
    return { ok: false, error: 'Kein NFT-Besitz / keine aktive Leihe — Klartext gesperrt (P4a).' }
  }
  const needsWallet =
    opts.meta.gate === 'nft_and_wallet_p4a' ||
    opts.meta.gate === 'nft_and_wallet_pubkey_p4a2' ||
    (opts.meta.gate === 'nft_seal_p4b' && Boolean(opts.meta.requiredWallet))
  if (needsWallet) {
    const need = opts.meta.requiredWallet ? normHex(opts.meta.requiredWallet) : ''
    const me = opts.signerAddress ? normHex(opts.signerAddress) : ''
    if (!HEX64.test(need)) {
      return { ok: false, error: 'Wire: requiredWallet fehlt oder ungültig.' }
    }
    if (!me || me !== need) {
      return {
        ok: false,
        error: 'Falsche Wallet — dieses Gate verlangt die festgelegte Adresse und NFT-Leserecht.',
      }
    }
  }
  return { ok: true }
}

function parseNftGateBlob(content: string): { meta: NftGateMetaV1; body: Uint8Array } {
  const t = content.trim()
  if (!t.startsWith(PREFIX)) throw new Error('Keine NFT-Gate-Nachricht (MORG_NFTGATE_V1).')
  const blob = b64ToBytes(t.slice(PREFIX.length).trim())
  const magic = new TextEncoder().encode(MAGIC)
  if (blob.length < magic.length + 2) throw new Error('Ciphertext zu kurz.')
  for (let i = 0; i < magic.length; i++) {
    if (blob[i] !== magic[i]) throw new Error('Ungültiges Magic.')
  }
  const metaLen = ((blob[magic.length]! << 8) | blob[magic.length + 1]!) >>> 0
  const metaStart = magic.length + 2
  const metaEnd = metaStart + metaLen
  if (metaEnd > blob.length) throw new Error('Ciphertext beschädigt.')
  const meta = JSON.parse(new TextDecoder().decode(blob.slice(metaStart, metaEnd))) as NftGateMetaV1
  if (meta.schema !== SCHEMA) throw new Error('Unbekanntes NFT-Gate-Schema.')
  if (
    meta.gate !== 'nft_owner_p4a' &&
    meta.gate !== 'nft_and_wallet_p4a' &&
    meta.gate !== 'nft_and_wallet_pubkey_p4a2' &&
    meta.gate !== 'nft_seal_p4b'
  ) {
    throw new Error('Unbekannter Gate-Modus.')
  }
  const nftObjectId = normHex(meta.nftObjectId)
  if (!HEX64.test(nftObjectId)) throw new Error('nftObjectId ungültig.')
  let requiredWallet: string | undefined
  if (
    meta.gate === 'nft_and_wallet_p4a' ||
    meta.gate === 'nft_and_wallet_pubkey_p4a2' ||
    (meta.gate === 'nft_seal_p4b' && meta.requiredWallet)
  ) {
    requiredWallet = meta.requiredWallet ? normHex(meta.requiredWallet) : ''
    if (!HEX64.test(requiredWallet)) throw new Error('requiredWallet ungültig.')
  }
  if (meta.gate === 'nft_and_wallet_pubkey_p4a2') {
    if (!meta.ephemeralPubRawB64) throw new Error('P4a2: ephemeralPubRawB64 fehlt.')
    const eph = b64ToBytes(meta.ephemeralPubRawB64)
    if (eph.length !== P256_RAW_PUB_LEN) throw new Error('P4a2: ephemeral Pub ungültig.')
  }
  if (meta.gate === 'nft_seal_p4b' && !meta.sealPolicy) {
    meta.sealPolicy = requiredWallet ? 'nft_and_wallet' : 'nft_owner'
  }
  return {
    meta: {
      ...meta,
      nftObjectId,
      ...(requiredWallet ? { requiredWallet } : {}),
    },
    body: blob.slice(metaEnd),
  }
}

export async function encryptNftGateMessage(opts: {
  plainUtf8: string
  nftObjectId: string
  /** Dual / Basis für P4a2 / optional P4b. */
  requiredWallet?: string | null
  /**
   * P4a2: uncompressed P-256 Pub (65 B) der requiredWallet.
   * Wenn gesetzt → Gate nft_and_wallet_pubkey_p4a2.
   */
  recipientEcdhPubRaw?: Uint8Array | null
  /**
   * P4b: 32-Byte Seal wrap key vom Broker.
   * Wenn gesetzt → Gate nft_seal_p4b (hat Vorrang vor P4a2).
   */
  sealWrapKeyRaw?: Uint8Array | null
}): Promise<{ wire: string; nftObjectId: string; gate: NftGateMode }> {
  const nftObjectId = normHex(opts.nftObjectId)
  if (!HEX64.test(nftObjectId)) throw new Error('NFT Object-ID: 0x + 64 Hex nötig.')
  const requiredWallet = opts.requiredWallet?.trim()
    ? normHex(opts.requiredWallet)
    : undefined
  if (requiredWallet && !HEX64.test(requiredWallet)) {
    throw new Error('requiredWallet: 0x + 64 Hex nötig.')
  }

  const sealKey = opts.sealWrapKeyRaw
  const useP4b = Boolean(sealKey && sealKey.length === 32)
  if (opts.sealWrapKeyRaw && !useP4b) {
    throw new Error('sealWrapKeyRaw: 32 Byte nötig (Broker).')
  }

  const pubRaw = opts.recipientEcdhPubRaw
  const useP4a2 = !useP4b && Boolean(pubRaw && pubRaw.length === P256_RAW_PUB_LEN)
  if (!useP4b && opts.recipientEcdhPubRaw && !useP4a2) {
    throw new Error('recipientEcdhPubRaw: 65-Byte P-256 uncompressed nötig.')
  }
  if (useP4a2 && !requiredWallet) {
    throw new Error('P4a2 braucht requiredWallet.')
  }

  const gate: NftGateMode = useP4b
    ? 'nft_seal_p4b'
    : useP4a2
      ? 'nft_and_wallet_pubkey_p4a2'
      : requiredWallet
        ? 'nft_and_wallet_p4a'
        : 'nft_owner_p4a'

  const dek = crypto.getRandomValues(new Uint8Array(DEK_BYTES))
  const wrapSalt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const wrapIv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const bodyIv = crypto.getRandomValues(new Uint8Array(IV_BYTES))

  let wrapKey: CryptoKey
  let ephemeralPubRawB64: string | undefined
  if (useP4b && sealKey) {
    wrapKey = await getSubtle().importKey('raw', sealKey as BufferSource, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ])
  } else if (useP4a2 && requiredWallet && pubRaw) {
    const eph = await generateKeyPair(true)
    const shared = await deriveSharedSecret(eph.privateKey, pubRaw)
    wrapKey = await deriveEcdhWrapKey(shared, wrapSalt, nftObjectId, requiredWallet)
    ephemeralPubRawB64 = bytesToB64(eph.pubRaw)
    shared.fill(0)
  } else {
    wrapKey = await deriveHkdfWrapKey(wrapSalt, nftObjectId, requiredWallet)
  }

  const wrappedDek = new Uint8Array(
    await getSubtle().encrypt({ name: 'AES-GCM', iv: wrapIv }, wrapKey, dek)
  )

  const dekKey = await getSubtle().importKey('raw', dek, { name: 'AES-GCM' }, false, ['encrypt'])
  const body = new Uint8Array(
    await getSubtle().encrypt(
      { name: 'AES-GCM', iv: bodyIv },
      dekKey,
      new TextEncoder().encode(opts.plainUtf8)
    )
  )
  dek.fill(0)

  const meta: NftGateMetaV1 = {
    schema: SCHEMA,
    gate,
    nftObjectId,
    ...(requiredWallet ? { requiredWallet } : {}),
    ...(ephemeralPubRawB64 ? { ephemeralPubRawB64 } : {}),
    ...(useP4b
      ? { sealPolicy: requiredWallet ? 'nft_and_wallet' : 'nft_owner' }
      : {}),
    algo: 'AES-256-GCM',
    bodyIvB64: bytesToB64(bodyIv),
    wrapSaltB64: bytesToB64(wrapSalt),
    wrapIvB64: bytesToB64(wrapIv),
    wrappedDekB64: bytesToB64(wrappedDek),
  }
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta))
  const magic = new TextEncoder().encode(MAGIC)
  const blob = new Uint8Array(magic.length + 2 + metaBytes.length + body.length)
  blob.set(magic, 0)
  blob[magic.length] = (metaBytes.length >> 8) & 0xff
  blob[magic.length + 1] = metaBytes.length & 0xff
  blob.set(metaBytes, magic.length + 2)
  blob.set(body, magic.length + 2 + metaBytes.length)
  return { wire: `${PREFIX}${bytesToB64(blob)}`, nftObjectId, gate }
}

/**
 * Bei Dual/P4a2/P4b-Dual: `signerAddress === requiredWallet`.
 * P4a2: `ecdhPrivateKey`. P4b: `sealWrapKeyRaw` vom Broker nach Ownership-Check.
 */
export async function decryptNftGateMessageWire(
  content: string,
  opts: {
    nftAccessOk: boolean
    signerAddress?: string | null
    ecdhPrivateKey?: CryptoKey | null
    sealWrapKeyRaw?: Uint8Array | null
  }
): Promise<string> {
  const { meta, body } = parseNftGateBlob(content)
  const access = evaluateNftGateAccess({
    meta,
    nftAccessOk: opts.nftAccessOk,
    signerAddress: opts.signerAddress,
  })
  if (!access.ok) throw new Error(access.error)

  let wrapKey: CryptoKey
  if (meta.gate === 'nft_seal_p4b') {
    const sk = opts.sealWrapKeyRaw
    if (!sk || sk.length !== 32) {
      throw new Error('P4b: Seal-Key vom Broker fehlt — Ownership/API prüfen.')
    }
    wrapKey = await getSubtle().importKey('raw', sk as BufferSource, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ])
  } else if (meta.gate === 'nft_and_wallet_pubkey_p4a2') {
    if (!opts.ecdhPrivateKey) {
      throw new Error('P4a2: Chat-ECDH-Privatkey fehlt — Vault entsperren.')
    }
    if (!meta.ephemeralPubRawB64 || !meta.requiredWallet) {
      throw new Error('P4a2-Wire unvollständig.')
    }
    const ephPub = b64ToBytes(meta.ephemeralPubRawB64)
    const shared = await deriveSharedSecret(opts.ecdhPrivateKey, ephPub)
    wrapKey = await deriveEcdhWrapKey(
      shared,
      b64ToBytes(meta.wrapSaltB64),
      meta.nftObjectId,
      meta.requiredWallet
    )
    shared.fill(0)
  } else {
    wrapKey = await deriveHkdfWrapKey(
      b64ToBytes(meta.wrapSaltB64),
      meta.nftObjectId,
      meta.requiredWallet
    )
  }

  let dek: Uint8Array
  try {
    dek = new Uint8Array(
      await getSubtle().decrypt(
        { name: 'AES-GCM', iv: b64ToBytes(meta.wrapIvB64) },
        wrapKey,
        b64ToBytes(meta.wrappedDekB64)
      )
    )
  } catch {
    throw new Error(
      meta.gate === 'nft_seal_p4b'
        ? 'P4b-Capsule: falscher Seal-Key oder beschädigt.'
        : meta.gate === 'nft_and_wallet_pubkey_p4a2'
          ? 'P4a2-Capsule: falscher Privatkey oder beschädigt.'
          : 'Capsule ungültig oder beschädigt.'
    )
  }
  try {
    const dekKey = await getSubtle().importKey('raw', dek, { name: 'AES-GCM' }, false, ['decrypt'])
    const plain = new Uint8Array(
      await getSubtle().decrypt({ name: 'AES-GCM', iv: b64ToBytes(meta.bodyIvB64) }, dekKey, body)
    )
    return new TextDecoder().decode(plain)
  } catch {
    throw new Error('Body-Decrypt fehlgeschlagen.')
  } finally {
    dek.fill(0)
  }
}
