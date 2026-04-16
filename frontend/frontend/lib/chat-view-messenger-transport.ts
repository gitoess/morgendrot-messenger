/**
 * Gemeinsame Transport-Typen für Chat-Senden, Anhänge und UI (ohne Abhängigkeit von Attachment-State).
 */

export type ForcedTransport = 'internet' | 'mesh' | 'adhoc'

/** Max. Zeichen für unverschlüsselten Klartext auf LoRa (Mesh v2 Nutzlast). */
export const MESH_PLAINTEXT_MAX_CHARS = 200

/** `mesh` → LoRa/Meshtastic (JPEG LUMA+CHROMA). `internet` / `adhoc` → IOTA-Kompaktbild bei Anhängen. */
export function isLoRaMeshTransport(t: ForcedTransport): boolean {
  return t === 'mesh'
}

export type MeshtasticBleSendApi = {
  connected: boolean
  sendBinaryV2: (raw: Uint8Array, destination?: number | 'broadcast') => Promise<unknown>
  /** Klartext über Meshtastic (TEXT_MESSAGE_APP). `destination` = Knoten-Nummer oder Broadcast. */
  sendMeshText: (text: string, destination?: number | 'broadcast') => Promise<unknown>
}
