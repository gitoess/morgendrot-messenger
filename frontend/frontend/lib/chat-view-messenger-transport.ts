/**
 * Gemeinsame Transport-Typen für Chat-Senden, Anhänge und UI (ohne Abhängigkeit von Attachment-State).
 */

export type ForcedTransport = 'internet' | 'mesh' | 'adhoc'

/** Max. Zeichen für unverschlüsselten Klartext auf LoRa (Meshtastic TEXT_MESSAGE / LongFast). */
export const MESH_PLAINTEXT_MAX_CHARS = 200

/** `mesh` → Meshtastic-Funk. Bild: Roh→LUMA+CHROMA nur mit Pfad 4 (Klartext); sonst siehe `CHAT_LORA_DUAL_IMAGE_POLICY_MSG`. `internet`/`adhoc` → IOTA-Kompaktbild beim Import. */
export function isLoRaMeshTransport(t: ForcedTransport): boolean {
  return t === 'mesh'
}

/** LUMA+CHROMA im Composer nur: online+verschlüsselt+privat, oder Funk+Pfad4+Klartext+privat. */
export const CHAT_LORA_DUAL_IMAGE_POLICY_MSG =
  'LoRa-Bild (LUMA+CHROMA): „online“ mit Verschlüsselung — oder „funk“ mit „LoRa + eigene Verankerung“ (Klartext, Pfad 4). Sonst Anhang entfernen.'

export function isAttachedLoraDualComposerAllowed(p: {
  isPrivate: boolean
  encrypted: boolean
  forcedTransport: ForcedTransport
  meshSelfArchiveAfterLoRa: boolean
}): boolean {
  if (!p.isPrivate) return false
  if (p.forcedTransport === 'internet' && p.encrypted) return true
  if (isLoRaMeshTransport(p.forcedTransport) && !p.encrypted && p.meshSelfArchiveAfterLoRa) return true
  return false
}

export type MeshtasticBleSendApi = {
  connected: boolean
  sendBinaryV2: (raw: Uint8Array, destination?: number | 'broadcast') => Promise<unknown>
  /** Klartext über Meshtastic (TEXT_MESSAGE_APP). `destination` = Knoten-Nummer oder Broadcast. */
  sendMeshText: (text: string, destination?: number | 'broadcast') => Promise<unknown>
}
