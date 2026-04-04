/**
 * Browser-Variante von lora-bridge emergency-binary v2 (nur Parse + SHA256-Vergleich).
 * Layout: [0]=2, [1..4] nonce BE, [5..36] sha256(utf8 iota addr), [37..] ciphertext
 */
export const EMERGENCY_BINARY_VERSION = 2
const HEADER_LEN = 37

export type EmergencyBinaryV2Parsed = {
  nonce: number
  fingerprintHex: string
  ciphertext: Uint8Array
}

export function tryParseEmergencyBinaryV2(raw: Uint8Array, maxTotalBytes: number): EmergencyBinaryV2Parsed | null {
  if (raw.length < HEADER_LEN || raw[0] !== EMERGENCY_BINARY_VERSION) return null
  if (raw.length > maxTotalBytes) return null
  const nonce = (raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]
  const fp = raw.slice(5, 37)
  const ciphertext = raw.slice(37)
  const hex = [...fp].map((b) => b.toString(16).padStart(2, '0')).join('')
  return {
    nonce: nonce >>> 0,
    fingerprintHex: hex,
    ciphertext,
  }
}

function hexSha256(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** SHA-256 der normalisierten IOTA-Adresse (UTF-8), wie im Backend emergency-binary. */
export async function iotaAddressFingerprintHex(address: string): Promise<string | null> {
  const a = address.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(a)) return null
  const enc = new TextEncoder().encode(a)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return hexSha256(buf)
}

/** Findet 0x-Adresse im Verzeichnis, deren Fingerprint dem Wire-Header entspricht. */
/** Browser-sichere Base64-Kodierung (kleine Payloads, z. B. Mesh-Wire). */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[])
  }
  return btoa(binary)
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function findAddressByV2Fingerprint(
  fingerprintHex: string,
  directoryAddresses: string[]
): Promise<string | null> {
  const want = fingerprintHex.toLowerCase()
  for (const addr of directoryAddresses) {
    const fp = await iotaAddressFingerprintHex(addr)
    if (fp === want) return addr.trim().toLowerCase()
  }
  return null
}
