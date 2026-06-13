import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { isLoRaMeshTransport } from '@/frontend/lib/chat-view-messenger-transport'

/** `1` = LoRa-Bilder (LUMA/CHROMA) über Mesh senden/anhängen. */
export const MESH_LORA_IMAGES_LS = 'morgendrot.meshLoRaImagesEnabled'

/** `1` = nach Funk optional eigene Mailbox-Kopie auf Chain (Pfad-4-Verankerung). */
export const MESH_SELF_ARCHIVE_PATH4_LS = 'morgendrot.meshSelfArchiveAfterLoRa'

export type MeshLoRaComposerContext = {
  isPrivate: boolean
  forcedTransport: ForcedTransport
  meshLoRaImagesEnabled: boolean
  meshSelfArchiveAfterLoRa: boolean
}

/** Funk-Bild: MORG_SEG_V1 über Meshtastic (Luft bleibt Klartext). */
export function isMeshLoRaImageSendActive(
  p: Pick<MeshLoRaComposerContext, 'isPrivate' | 'forcedTransport' | 'meshLoRaImagesEnabled'>
): boolean {
  return p.isPrivate && isLoRaMeshTransport(p.forcedTransport) && p.meshLoRaImagesEnabled
}

/** Nach erfolgreichem Funk: Klartext-Mailbox an eigene Adresse (+ Queue). */
export function isMeshPath4SelfArchiveActive(
  p: Pick<MeshLoRaComposerContext, 'isPrivate' | 'forcedTransport' | 'meshSelfArchiveAfterLoRa'>
): boolean {
  return p.isPrivate && isLoRaMeshTransport(p.forcedTransport) && p.meshSelfArchiveAfterLoRa
}

export function readMeshLoRaImagesEnabledFromStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = window.localStorage.getItem(MESH_LORA_IMAGES_LS)
    if (v === '1') return true
    if (v === '0') return false
    /** Migration: früher war Bild+Funk an dieselbe Pfad-4-Checkbox gekoppelt. */
    return window.localStorage.getItem(MESH_SELF_ARCHIVE_PATH4_LS) === '1'
  } catch {
    return false
  }
}

export function readMeshSelfArchiveAfterLoRaFromStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(MESH_SELF_ARCHIVE_PATH4_LS) === '1'
  } catch {
    return false
  }
}
