'use client'

/** Passwortgeschützter Einsatzbericht (Web Crypto). Öffnen: /einsatzbericht-decrypt.html */

const SCHEMA = 'morgendrot.einsatzbericht.enc.v1'
const SCHEMA_PROTOKOLL_ZIP = 'morgendrot.einsatzprotokoll.zip.enc.v1' as const
const PBKDF2_ITERATIONS = 210_000
const SALT_BYTES = 16
const IV_BYTES = 12

function bytesToB64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!)
  return btoa(s)
}

export type EinsatzberichtEncryptedFile = {
  schema: typeof SCHEMA
  kdf: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  saltB64: string
  ivB64: string
  ciphertextB64: string
}

async function deriveAesGcmKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
}

export async function encryptEinsatzberichtUtf8(plainUtf8: string, password: string): Promise<EinsatzberichtEncryptedFile> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const aesKey = await deriveAesGcmKey(password, salt)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(plainUtf8)))
  return {
    schema: SCHEMA,
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: PBKDF2_ITERATIONS,
    saltB64: bytesToB64(salt),
    ivB64: bytesToB64(iv),
    ciphertextB64: bytesToB64(ct),
  }
}

export type EinsatzprotokollZipEncryptedFile = {
  schema: typeof SCHEMA_PROTOKOLL_ZIP
  kdf: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  saltB64: string
  ivB64: string
  ciphertextB64: string
}

/** Rohes ZIP (protokoll.json + protokoll.html + medien/) — gleiche KDF wie Einsatzbericht, Klartext = Binärdaten. */
export async function encryptEinsatzprotokollZipBytes(
  plainZip: Uint8Array,
  password: string
): Promise<EinsatzprotokollZipEncryptedFile> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const aesKey = await deriveAesGcmKey(password, salt)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plainZip))
  return {
    schema: SCHEMA_PROTOKOLL_ZIP,
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: PBKDF2_ITERATIONS,
    saltB64: bytesToB64(salt),
    ivB64: bytesToB64(iv),
    ciphertextB64: bytesToB64(ct),
  }
}

export function downloadEinsatzprotokollEncryptedJson(envelope: EinsatzprotokollZipEncryptedFile): void {
  const json = JSON.stringify(envelope, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // Kein fertiges .zip: JSON-Hülle; nach Entschlüsselung = ZIP-Bytes (protokoll.json, protokoll.html, medien/).
  a.download = `morgendrot-einsatzprotokoll-${Date.now()}.zip.enc.json`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadEinsatzberichtEncryptedJson(envelope: EinsatzberichtEncryptedFile): void {
  const json = JSON.stringify(envelope, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `morgendrot-einsatzbericht-verschluesselt-${Date.now()}.json`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
