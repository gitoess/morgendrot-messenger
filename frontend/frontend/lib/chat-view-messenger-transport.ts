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

/**
 * LUMA+CHROMA im Composer: online+verschlüsselt+privat, oder Funk+Pfad4+privat.
 * Pfad 4 sendet über die Luft immer Klartext — der Schloss-Toggle darf trotzdem an sein (Mailbox/andere Pfade).
 */
export const CHAT_LORA_DUAL_IMAGE_POLICY_MSG =
  'LoRa-Bild (LUMA+CHROMA): „online“ mit Verschlüsselung — oder „funk“ mit aktivem „LoRa + eigene Verankerung“ (Pfad 4; Funk bleibt Klartext). Sonst Anhang entfernen.'

/** Pfad 4: Funk sofort (Klartext), danach eigene Mailbox + optionale Attestation/Verankerung. */
export const CHAT_PATH4_SELF_ARCHIVE_HINT =
  'Pfad 4: Funk geht sofort als Klartext raus. Zusätzlich wird eine eigene Mailbox-Kopie an deine Adresse geschrieben (später im Tangle sichtbar), sobald Basis/Internet verfügbar ist.'

/** Verschlüsselte Peer-Nachrichten brauchen vorherigen Schlüsselkanal (`/handshake` + `/connect`). */
export const CHAT_ENCRYPTED_HANDSHAKE_REQUIRED_MSG =
  'Verschlüsselte Nachricht an andere Person: zuerst Handshake/Connect über Online-IOTA aufbauen. Ohne verbundenen Partner ist nur Klartext (Funk/Pfad 4) oder Versand an dich selbst sinnvoll.'

/** Aktueller Produktzustand: verschlüsselter LoRa-Funk ist bewusst aus; Pfad 4 bleibt Klartext. */
export const CHAT_ENCRYPTED_MESH_DISABLED_MSG =
  'Verschlüsselter LoRa-Funk ist deaktiviert. Für Verschlüsselung: „online“ mit verbundenem Partner (Handshake/Connect). Für Einsatz-Protokoll: Pfad 4 nutzt Klartext-Funk + eigene Verankerung.'

export function isAttachedLoraDualComposerAllowed(p: {
  isPrivate: boolean
  encrypted: boolean
  forcedTransport: ForcedTransport
  meshSelfArchiveAfterLoRa: boolean
}): boolean {
  void p.encrypted /* Mesh+Pfad4: Luft Klartext; Schloss betrifft nur Online-/Mailbox-Pfade. */
  if (!p.isPrivate) return false
  if (p.forcedTransport === 'internet' && p.encrypted) return true
  if (isLoRaMeshTransport(p.forcedTransport) && p.meshSelfArchiveAfterLoRa) return true
  return false
}

export type MeshtasticBleSendApi = {
  connected: boolean
  sendBinaryV2: (raw: Uint8Array, destination?: number | 'broadcast') => Promise<unknown>
  /** Klartext über Meshtastic (TEXT_MESSAGE_APP). `destination` = Knoten-Nummer oder Broadcast. */
  sendMeshText: (text: string, destination?: number | 'broadcast') => Promise<unknown>
}
