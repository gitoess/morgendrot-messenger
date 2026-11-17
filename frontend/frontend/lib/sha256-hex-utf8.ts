'use client'

import { sha256HexOfBytes } from '@/frontend/lib/sha256-bytes'

/** SHA-256 (hex, 64 Zeichen) über UTF-8-Bytes — z. B. SOS-/Ack-Referenz gleicher Nutzlast. */
export async function sha256HexUtf8(text: string): Promise<string> {
  return sha256HexOfBytes(new TextEncoder().encode(text))
}
