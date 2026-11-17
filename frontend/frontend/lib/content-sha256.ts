/**
 * SHA-256 für Text / Dateien — Besitz-/Integritätsnachweis (lokal prüfen).
 * LAN-HTTP: `crypto.subtle` fehlt → Fallback in `sha256-bytes`.
 */
import { sha256HexOfBytes as sha256HexOfBytesImpl } from '@/frontend/lib/sha256-bytes'

export async function sha256HexOfBytes(data: ArrayBuffer | Uint8Array): Promise<string> {
  return sha256HexOfBytesImpl(data)
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
