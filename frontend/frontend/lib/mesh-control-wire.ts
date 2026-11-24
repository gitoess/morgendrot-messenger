/**
 * Funk-Steuerdrähte (S-ARQ) — gehören nicht als eigene Chat-Zeilen in den Posteingang.
 * Segmente werden ohnehin zu einer Session kollabiert; NAK/ACK sind reine Steuerung.
 */

import { normalizeMessengerWireContent } from '@/frontend/lib/compact-image-wire'

export function isMorgendrotMeshNakWire(content: string): boolean {
  return normalizeMessengerWireContent(content).includes('MORG_NAK_V1')
}

/** INIT / SEG / NAK — alles, was die Inbox nur „Müll“-Zeilen erzeugen würde. */
export function isMorgendrotMeshSarqControlWire(content: string): boolean {
  const t = normalizeMessengerWireContent(content)
  return (
    t.includes('MORG_NAK_V1') ||
    t.includes('MORG_SEG_V1') ||
    t.includes('MORG_IMG_INIT_V1')
  )
}
