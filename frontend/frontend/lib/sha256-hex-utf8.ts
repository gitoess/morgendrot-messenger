'use client'

/** SHA-256 (hex, 64 Zeichen) über UTF-8-Bytes — z. B. SOS-/Ack-Referenz gleicher Nutzlast. */
export async function sha256HexUtf8(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', enc)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
