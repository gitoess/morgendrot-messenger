/**
 * SHA-256 für Text / Dateien — Besitz-/Integritätsnachweis (lokal prüfen).
 */

function bytesToHex(buf: ArrayBuffer): string {
  const a = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < a.length; i++) hex += a[i]!.toString(16).padStart(2, '0')
  return hex
}

export async function sha256HexOfBytes(data: ArrayBuffer | Uint8Array): Promise<string> {
  const view =
    data instanceof Uint8Array
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : data
  const dig = await crypto.subtle.digest('SHA-256', view as ArrayBuffer)
  return bytesToHex(dig)
}

export async function sha256HexOfUtf8(text: string): Promise<string> {
  return sha256HexOfBytes(new TextEncoder().encode(text))
}

export async function sha256HexOfBlob(blob: Blob): Promise<string> {
  return sha256HexOfBytes(await blob.arrayBuffer())
}

/** Erwarteten Hash normalisieren (ohne 0x, klein, Whitespace weg). */
export function normalizeSha256Hex(raw: string): string {
  return raw.trim().toLowerCase().replace(/^0x/, '').replace(/\s+/g, '')
}

export function isSha256Hex64(hex: string): boolean {
  return /^[a-f0-9]{64}$/.test(normalizeSha256Hex(hex))
}
