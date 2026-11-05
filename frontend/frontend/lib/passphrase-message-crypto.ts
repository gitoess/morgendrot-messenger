/**
 * Passphrase-geschützte Chat-Nachricht (ohne Handshake).
 * Ciphertext geht als „Klartext“-Wire on-chain; Passphrase nur off-chain teilen.
 *
 * Wire: MORG_PWMSG_V1:<base64(magic|metaLen|meta|cipher)>
 */

import { resolveHandoffPbdkf2Iterations } from '@/frontend/lib/handoff-zip-crypto'
import { generateEvidenceImageSharePassphrase } from '@/frontend/lib/evidence-image-crypto'

export const PASSPHRASE_MSG_WIRE_PREFIX = 'MORG_PWMSG_V1:'
export const PASSPHRASE_MSG_MAGIC = 'MORGPWMSG1'
export const PASSPHRASE_MSG_SCHEMA = 'morgendrot.passphrase.msg.v1' as const

const SALT_BYTES = 16
const IV_BYTES = 12

type Meta = {
  schema: typeof PASSPHRASE_MSG_SCHEMA
  kdf: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  algo: 'AES-256-GCM'
  saltB64: string
  ivB64: string
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

export function isPassphraseMessageWire(content: string): boolean {
  return content.trimStart().startsWith(PASSPHRASE_MSG_WIRE_PREFIX)
}

export function generatePassphraseMessageSharePassphrase(): string {
  return generateEvidenceImageSharePassphrase(18)
}

export async function encryptPassphraseMessage(
  plainUtf8: string,
  password?: string
): Promise<{ wire: string; passphrase: string }> {
  const passphrase = (password || generatePassphraseMessageSharePassphrase()).trim()
  if (passphrase.length < 8) throw new Error('Passphrase mindestens 8 Zeichen.')
  const plain = new TextEncoder().encode(plainUtf8)
  const iterations = resolveHandoffPbdkf2Iterations()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(passphrase, salt, iterations, false)
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain))
  const meta: Meta = {
    schema: PASSPHRASE_MSG_SCHEMA,
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations,
    algo: 'AES-256-GCM',
    saltB64: bytesToB64(salt),
    ivB64: bytesToB64(iv),
  }
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta))
  const magic = new TextEncoder().encode(PASSPHRASE_MSG_MAGIC)
  const blob = new Uint8Array(magic.length + 2 + metaBytes.length + ciphertext.length)
  blob.set(magic, 0)
  blob[magic.length] = (metaBytes.length >> 8) & 0xff
  blob[magic.length + 1] = metaBytes.length & 0xff
  blob.set(metaBytes, magic.length + 2)
  blob.set(ciphertext, magic.length + 2 + metaBytes.length)
  return { wire: `${PASSPHRASE_MSG_WIRE_PREFIX}${bytesToB64(blob)}`, passphrase }
}

export async function decryptPassphraseMessageWire(
  content: string,
  password: string
): Promise<string> {
  const t = content.trim()
  if (!t.startsWith(PASSPHRASE_MSG_WIRE_PREFIX)) {
    throw new Error('Keine Passphrase-Nachricht (MORG_PWMSG_V1).')
  }
  if (!password || password.trim().length < 8) {
    throw new Error('Passphrase mindestens 8 Zeichen.')
  }
  const blob = b64ToBytes(t.slice(PASSPHRASE_MSG_WIRE_PREFIX.length).trim())
  const magic = new TextEncoder().encode(PASSPHRASE_MSG_MAGIC)
  if (blob.length < magic.length + 2) throw new Error('Ciphertext zu kurz.')
  for (let i = 0; i < magic.length; i++) {
    if (blob[i] !== magic[i]) throw new Error('Ungültiges Magic.')
  }
  const metaLen = ((blob[magic.length]! << 8) | blob[magic.length + 1]!) >>> 0
  const metaStart = magic.length + 2
  const metaEnd = metaStart + metaLen
  if (metaEnd > blob.length) throw new Error('Ciphertext beschädigt.')
  const meta = JSON.parse(new TextDecoder().decode(blob.slice(metaStart, metaEnd))) as Meta
  if (meta.schema !== PASSPHRASE_MSG_SCHEMA) throw new Error('Unbekanntes Schema.')
  const key = await deriveKey(password.trim(), b64ToBytes(meta.saltB64), meta.iterations, true)
  try {
    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(meta.ivB64) }, key, blob.slice(metaEnd))
    )
    return new TextDecoder().decode(plain)
  } catch {
    throw new Error('Falsche Passphrase oder beschädigte Daten.')
  }
}
