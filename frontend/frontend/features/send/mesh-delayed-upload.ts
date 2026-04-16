'use client'

/**
 * Delayed Upload (MVP): Sender setzt `[[MORG_DELAY_MIRROR_V1]]` vor den Klartext (Mesh v2); der Empfänger
 * entfernt den Marker nach Decrypt und spiegelt den Inhalt per Mailbox in den Tangle (`onDelayMirrorPlaintext`).
 * Gilt für **Nur-Text**, **kompakte Bilder**, **Audio/.txt** und **LoRa LUMA/CHROMA** — jeweils nur wenn der Nutzer
 * **„LoRa + Tangle“** wählt (UI) und der Wire nach Marker-Präfix noch unter den Chain-Limits bleibt.
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
