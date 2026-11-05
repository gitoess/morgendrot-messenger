/**
 * Evidenz-Bild: echte AES-256-GCM-Verschlüsselung der image_data-Bytes (Client).
 * Schlüssel/Passphrase nie on-chain — nur separat teilen (Anzeige nach Mint).
 *
 * Wire-Format in image_data:
 *   magic "MORGIMGE1" (9) | metaLen u16 BE | meta JSON utf8 | ciphertext
 */

import { resolveHandoffPbdkf2Iterations } from '@/frontend/lib/handoff-zip-crypto'

export const EVIDENCE_IMAGE_ENC_MAGIC = 'MORGIMGE1'
export const EVIDENCE_IMAGE_ENC_SCHEMA = 'morgendrot.evidence.image.enc.v1' as const

const SALT_BYTES = 16
const IV_BYTES = 12

export type EvidenceImageCryptoMeta = {
  schema: typeof EVIDENCE_IMAGE_ENC_SCHEMA
  kdf: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  algo: 'AES-256-GCM'
  saltB64: string
  ivB64: string
  contentType: string
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

function magicBytes(): Uint8Array {
  return new TextEncoder().encode(EVIDENCE_IMAGE_ENC_MAGIC)
}

export function isEvidenceImageEncryptedBlob(raw: Uint8Array): boolean {
  const m = magicBytes()
  if (raw.length < m.length + 2) return false
  for (let i = 0; i < m.length; i++) if (raw[i] !== m[i]) return false
  return true
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number, decrypt: boolean): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    decrypt ? ['decrypt'] : ['encrypt']
  )
}

/** Zufällige Share-Passphrase (Anzeige nach Mint — einmalig kopieren). */
export function generateEvidenceImageSharePassphrase(bytes = 18): string {
  const u8 = crypto.getRandomValues(new Uint8Array(bytes))
  return bytesToB64(u8).replace(/\+/g, 'x').replace(/\//g, 'y').replace(/=+$/, '')
}

export async function encryptEvidenceImageBytes(
  plain: Uint8Array,
  password: string,
  contentType: string
): Promise<{ blob: Uint8Array; meta: EvidenceImageCryptoMeta; passphrase: string }> {
  if (!password || password.length < 8) {
    throw new Error('Passphrase mindestens 8 Zeichen.')
  }
  const iterations = resolveHandoffPbdkf2Iterations()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt, iterations, false)
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain))
  const meta: EvidenceImageCryptoMeta = {
    schema: EVIDENCE_IMAGE_ENC_SCHEMA,
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations,
    algo: 'AES-256-GCM',
    saltB64: bytesToB64(salt),
    ivB64: bytesToB64(iv),
    contentType: contentType || 'application/octet-stream',
  }
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta))
  if (metaBytes.length > 0xffff) throw new Error('Crypto-Meta zu groß.')
  const magic = magicBytes()
  const out = new Uint8Array(magic.length + 2 + metaBytes.length + ciphertext.length)
  out.set(magic, 0)
  out[magic.length] = (metaBytes.length >> 8) & 0xff
  out[magic.length + 1] = metaBytes.length & 0xff
  out.set(metaBytes, magic.length + 2)
  out.set(ciphertext, magic.length + 2 + metaBytes.length)
  return { blob: out, meta, passphrase: password }
}

export async function decryptEvidenceImageBytes(
  blob: Uint8Array,
  password: string
): Promise<{ bytes: Uint8Array; contentType: string; meta: EvidenceImageCryptoMeta }> {
  if (!isEvidenceImageEncryptedBlob(blob)) {
    throw new Error('Kein Morgendrot-Evidenz-Ciphertext (Magic MORGIMGE1 fehlt).')
  }
  const magicLen = magicBytes().length
  const metaLen = ((blob[magicLen]! << 8) | blob[magicLen + 1]!) >>> 0
  const metaStart = magicLen + 2
  const metaEnd = metaStart + metaLen
  if (metaEnd > blob.length) throw new Error('Ciphertext beschädigt (Meta-Länge).')
  const meta = JSON.parse(new TextDecoder().decode(blob.slice(metaStart, metaEnd))) as EvidenceImageCryptoMeta
  if (meta.schema !== EVIDENCE_IMAGE_ENC_SCHEMA) throw new Error('Unbekanntes Crypto-Schema.')
  const salt = b64ToBytes(meta.saltB64)
  const iv = b64ToBytes(meta.ivB64)
  const key = await deriveKey(password, salt, meta.iterations, true)
  const cipher = blob.slice(metaEnd)
  try {
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher))
    return { bytes: plain, contentType: meta.contentType || 'application/octet-stream', meta }
  } catch {
    throw new Error('Falsche Passphrase oder beschädigte Daten.')
  }
}
