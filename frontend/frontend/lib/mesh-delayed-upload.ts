'use client'

/**
 * Delayed Upload (MVP): Sender kennzeichnet Klartext vor Mesh-v2; Empfänger spiegelt nach Decrypt per /send (IOTA).
 * Luma/Chroma: Marker nur bei reinem Text-Mesh – Bild-Wires nicht präfixen (Parser würde brechen).
 */
export const MORG_DELAY_MIRROR_V1 = '[[MORG_DELAY_MIRROR_V1]]'

export function prependDelayMirrorMarker(plaintext: string): string {
  if (plaintext.startsWith(MORG_DELAY_MIRROR_V1)) return plaintext
  return `${MORG_DELAY_MIRROR_V1}\n${plaintext}`
}

export function stripDelayMirrorMarker(plaintext: string): { mirrored: boolean; body: string } {
  const p = plaintext.trimStart()
  if (!p.startsWith(MORG_DELAY_MIRROR_V1)) {
    return { mirrored: false, body: plaintext }
  }
  const rest = plaintext.slice(plaintext.indexOf(MORG_DELAY_MIRROR_V1) + MORG_DELAY_MIRROR_V1.length)
  const body = rest.replace(/^\s*\n?/, '')
  return { mirrored: true, body }
}
