/**
 * Passwortgeschützter Handoff (.env) — AES-256-GCM + PBKDF2 (Web Crypto).
 * ZIP: handoff.morg.enc + handoff.crypto.json + minimales README (kein Passwort, keine IDs).
 */

export const HANDOFF_ENV_ENC_SCHEMA = 'morgendrot.handoff.env.enc.v1' as const
export const HANDOFF_ENV_ENC_FILENAME = 'handoff.morg.enc'
/** Abwärtskompatibel mit Doku-Entwurf */
export const HANDOFF_ENV_ENC_FILENAME_LEGACY = 'handoff.env.enc'
export const HANDOFF_CRYPTO_JSON_FILENAME = 'handoff.crypto.json'

const PBKDF2_ITERATIONS_DESKTOP = 210_000
const PBKDF2_ITERATIONS_MOBILE = 60_000

const SALT_BYTES = 16
const IV_BYTES = 12

export type HandoffCryptoMetaJson = {
  schema: typeof HANDOFF_ENV_ENC_SCHEMA
  kdf: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  algo: 'AES-256-GCM'
  saltB64: string
  ivB64: string
}

/** APK: weniger PBKDF2-Iterationen — WebView blockiert sonst mehrere Sekunden. */
export function resolveHandoffPbdkf2Iterations(): number {
  if (typeof window !== 'undefined') {
    const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (cap?.isNativePlatform?.()) return PBKDF2_ITERATIONS_MOBILE
  }
  return PBKDF2_ITERATIONS_DESKTOP
}

export const HANDOFF_ENCRYPTED_README = [
  'Morgendrot – Handoff (passwortgeschützt)',
  '========================================',
  '',
  'Die Einsatz-Konfiguration liegt verschlüsselt in handoff.morg.enc.',
  'Metadaten (Salt/IV): handoff.crypto.json — ohne Passwort nicht lesbar.',
  '',
  'Passwort: nur vom Boss über einen separaten Kanal (mündlich, Telefon, …).',
  'Nicht in dieser ZIP speichern.',
  '',
  'LoRa/Meshtastic-PSK und ggf. IOTA-Archiv-Hinweise: ebenfalls separat vom Boss.',
  '',
  'Import in der PWA: Einstellungen → Handoff importieren → ZIP wählen → Passwort.',
  'Bundle weiterhin: npm run bundle:standalone-smartphone',
  '',
  'Doku: docs/HANDOFF-ZIP-ENCRYPTION.md',
].join('\n')

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

async function deriveAesGcmKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
  decrypt: boolean
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    decrypt ? ['decrypt'] : ['encrypt']
  )
}

export function validateHandoffExportPassword(password: string, confirm: string): string | null {
  if (!password) return 'Bitte ein Handoff-Passwort eingeben.'
  if (password.length < 8) return 'Passwort mindestens 8 Zeichen (Feldübung); für echte Einsätze 12+ empfohlen.'
  if (password !== confirm) return 'Passwort und Wiederholung stimmen nicht überein.'
  return null
}

export async function encryptHandoffEnvUtf8(
  plainUtf8: string,
  password: string
): Promise<{ meta: HandoffCryptoMetaJson; ciphertext: Uint8Array }> {
  const iterations = resolveHandoffPbdkf2Iterations()
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const aesKey = await deriveAesGcmKey(password, salt, iterations, false)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(plainUtf8))
  )
  return {
    meta: {
      schema: HANDOFF_ENV_ENC_SCHEMA,
      kdf: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      algo: 'AES-256-GCM',
      saltB64: bytesToB64(salt),
      ivB64: bytesToB64(iv),
    },
    ciphertext,
  }
}

export async function decryptHandoffEnvUtf8(
  meta: HandoffCryptoMetaJson,
  ciphertext: Uint8Array,
  password: string
): Promise<{ ok: true; envText: string } | { ok: false; error: string }> {
  if (meta.schema !== HANDOFF_ENV_ENC_SCHEMA) {
    return { ok: false, error: 'Unbekanntes Handoff-Verschlüsselungsformat.' }
  }
  if (meta.kdf !== 'PBKDF2' || meta.algo !== 'AES-256-GCM') {
    return { ok: false, error: 'Handoff-Krypto-Metadaten nicht unterstützt.' }
  }
  const iterations = meta.iterations > 0 ? meta.iterations : PBKDF2_ITERATIONS_DESKTOP
  try {
    const salt = b64ToBytes(meta.saltB64)
    const iv = b64ToBytes(meta.ivB64)
    const aesKey = await deriveAesGcmKey(password, salt, iterations, true)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
    return { ok: true, envText: new TextDecoder().decode(plain) }
  } catch {
    return { ok: false, error: 'Passwort falsch oder Datei beschädigt.' }
  }
}

export function parseHandoffCryptoMetaJson(text: string): HandoffCryptoMetaJson | null {
  try {
    const j = JSON.parse(text) as HandoffCryptoMetaJson
    if (j?.schema !== HANDOFF_ENV_ENC_SCHEMA) return null
    if (!j.saltB64 || !j.ivB64) return null
    return j
  } catch {
    return null
  }
}
