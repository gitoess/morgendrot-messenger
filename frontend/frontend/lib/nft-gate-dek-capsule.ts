/**
 * H.23 B2-P4a / P4a-dual — NFT-Gate (+ optional festgelegte Wallet).
 *
 * DEK = random 32 B; Capsule = Wrap(DEK) mit HKDF gebunden an nftId[+ requiredWallet].
 * Vault: kein Blank-DEK. Unwrap in der App nur nach Gate-Checks.
 *
 * Ehrlichkeit: Adresse ist öffentlich — ohne Pubkey-Wrap/Seal bleibt das App-Gate
 * („stark nur mit ehrlicher App“). Einmal Klartext = kopierbar.
 * Spec: docs/NFT-SCHLUESSELKARTE-MODI.md §6a
 */

const PREFIX = 'MORG_NFTGATE_V1:'
const MAGIC = 'MORGNFTG1'
const SCHEMA = 'morgendrot.nftgate.msg.v1' as const
const WRAP_INFO = new TextEncoder().encode('morgendrot-nftgate-wrap-v1')
const SALT_BYTES = 16
const IV_BYTES = 12
const DEK_BYTES = 32
const HEX64 = /^0x[a-f0-9]{64}$/

export const NFT_GATE_WIRE_PREFIX = PREFIX
export const NFT_GATE_SCHEMA = SCHEMA

export type NftGateMode = 'nft_owner_p4a' | 'nft_and_wallet_p4a'

export type NftGateMetaV1 = {
  schema: typeof SCHEMA
  gate: NftGateMode
  nftObjectId: string
  /** Nur bei nft_and_wallet_p4a — Signer muss diese Adresse sein. */
  requiredWallet?: string
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

async function deriveWrapKey(
  wrapSalt: Uint8Array,
  nftObjectId: string,
  requiredWallet?: string | null
): Promise<CryptoKey> {
  const subtle = getSubtle()
  const nft = normHex(nftObjectId)
  // P4a (ohne Wallet): unverändert WRAP_INFO || nftId — alte Wires bleiben lesbar.
  // Dual: WRAP_INFO || "nftId|w|wallet" — Capsule an beide Meta-Felder gebunden.
  const tail = requiredWallet
    ? new TextEncoder().encode(`${nft}|w|${normHex(requiredWallet)}`)
    : new TextEncoder().encode(nft)
  const info = new Uint8Array(WRAP_INFO.length + tail.length)
  info.set(WRAP_INFO, 0)
  info.set(tail, WRAP_INFO.length)
  const ikm = await subtle.importKey('raw', wrapSalt as BufferSource, 'HKDF', false, ['deriveKey'])
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
  /** AddressOwner oder Lease-Borrower (Zeitkapsel) */
  nftAccessOk: boolean
  signerAddress: string | null | undefined
}): { ok: true } | { ok: false; error: string } {
  if (!opts.nftAccessOk) {
    return { ok: false, error: 'Kein NFT-Besitz / keine aktive Leihe — Klartext gesperrt (P4a).' }
  }
  if (opts.meta.gate === 'nft_and_wallet_p4a') {
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
  if (meta.gate !== 'nft_owner_p4a' && meta.gate !== 'nft_and_wallet_p4a') {
    throw new Error('Unbekannter Gate-Modus.')
  }
  const nftObjectId = normHex(meta.nftObjectId)
  if (!HEX64.test(nftObjectId)) throw new Error('nftObjectId ungültig.')
  let requiredWallet: string | undefined
  if (meta.gate === 'nft_and_wallet_p4a') {
    requiredWallet = meta.requiredWallet ? normHex(meta.requiredWallet) : ''
    if (!HEX64.test(requiredWallet)) throw new Error('requiredWallet ungültig.')
  }
  return {
    meta: { ...meta, nftObjectId, ...(requiredWallet ? { requiredWallet } : {}) },
    body: blob.slice(metaEnd),
  }
}

export async function encryptNftGateMessage(opts: {
  plainUtf8: string
  nftObjectId: string
  /** Wenn gesetzt → Gate nft_and_wallet_p4a (Wallet + NFT). */
  requiredWallet?: string | null
}): Promise<{ wire: string; nftObjectId: string; gate: NftGateMode }> {
  const nftObjectId = normHex(opts.nftObjectId)
  if (!HEX64.test(nftObjectId)) throw new Error('NFT Object-ID: 0x + 64 Hex nötig.')
  const requiredWallet = opts.requiredWallet?.trim()
    ? normHex(opts.requiredWallet)
    : undefined
  if (requiredWallet && !HEX64.test(requiredWallet)) {
    throw new Error('requiredWallet: 0x + 64 Hex nötig.')
  }
  const gate: NftGateMode = requiredWallet ? 'nft_and_wallet_p4a' : 'nft_owner_p4a'

  const dek = crypto.getRandomValues(new Uint8Array(DEK_BYTES))
  const wrapSalt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const wrapIv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const bodyIv = crypto.getRandomValues(new Uint8Array(IV_BYTES))

  const wrapKey = await deriveWrapKey(wrapSalt, nftObjectId, requiredWallet)
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
 * `nftAccessOk` = Owner- oder Lease-Borrower-Check (Caller).
 * Bei Dual-Gate zusätzlich `signerAddress === requiredWallet`.
 */
export async function decryptNftGateMessageWire(
  content: string,
  opts: { nftAccessOk: boolean; signerAddress?: string | null }
): Promise<string> {
  const { meta, body } = parseNftGateBlob(content)
  const access = evaluateNftGateAccess({
    meta,
    nftAccessOk: opts.nftAccessOk,
    signerAddress: opts.signerAddress,
  })
  if (!access.ok) throw new Error(access.error)

  const wrapKey = await deriveWrapKey(
    b64ToBytes(meta.wrapSaltB64),
    meta.nftObjectId,
    meta.requiredWallet
  )
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
    throw new Error('Capsule ungültig oder beschädigt.')
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
