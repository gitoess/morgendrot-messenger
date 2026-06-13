/**
 * Gemeinsame Transport-Typen für Chat-Senden, Anhänge und UI (ohne Abhängigkeit von Attachment-State).
 */

export type ForcedTransport = 'internet' | 'mesh' | 'adhoc'

/** Max. Zeichen für unverschlüsselten Klartext auf LoRa (Meshtastic TEXT_MESSAGE / LongFast). */
export const MESH_PLAINTEXT_MAX_CHARS = 200

/** `mesh` → Meshtastic-Funk. Bild: Roh→LUMA+CHROMA nur mit „Bilder über Funk“; Verankerung separat. */
export function isLoRaMeshTransport(t: ForcedTransport): boolean {
  return t === 'mesh'
}

/**
 * LUMA+CHROMA im Composer: online+verschlüsselt+privat, oder funk+„Bilder über Funk“+privat.
 * Chain-Verankerung (`meshSelfArchiveAfterLoRa`) ist davon unabhängig.
 */
export const CHAT_LORA_DUAL_IMAGE_POLICY_MSG =
  'LoRa-Bild (LUMA+CHROMA): „online“ mit Verschlüsselung — oder „funk“ mit aktivem „Bilder über Funk“. Chain-Verankerung ist optional. Sonst Anhang entfernen.'

/** Meshtastic Web Client — Geräte-/Kanal-Einstellungen (PSK, Primary/Secondary). */
export const MESHTASTIC_WEB_DEVICE_SETTINGS_URL = 'https://client.meshtastic.org/settings/device'

/** Nach Funk: optionale eigene Mailbox-Kopie (Tangle), sobald Basis/Internet da ist. */
export const CHAT_PATH4_SELF_ARCHIVE_HINT =
  'Verankerung: Nach erfolgreichem Funk wird optional eine Klartext-Kopie an deine Adresse geschrieben (später im Tangle sichtbar).'

export const CHAT_MESH_LORA_IMAGES_HINT =
  'Bilder über Funk: LUMA+CHROMA lokal kodieren und per Meshtastic senden (Klartext-Luft, S-ARQ). Unabhängig von Chain-Verankerung.'

/** Simple Mode: kurzer Hinweis wenn Verankerung aus. */
export const CHAT_SIMPLE_LORA_ARCHIV_HINT =
  'Funk-Nachricht geht sofort raus (Meshtastic, ggf. Kanal-PSK). Ohne Verankerung bleibt nur die Luft-Kopie — Chain-Kopie optional einschalten.'

/** Verschlüsselte Peer-Nachrichten brauchen den öffentlichen Schlüssel des Partners (Handshake angenommen oder Partner hat geantwortet). */
export const CHAT_ENCRYPTED_HANDSHAKE_REQUIRED_MSG =
  'Verschlüsselte Nachricht: zuerst Handshake mit dieser 0x — der Partner muss antworten oder du musst sein Angebot annehmen, bis der Status „Handshake aktiv“ erscheint.'

export const CHAT_ENCRYPTED_HANDSHAKE_AWAITING_PEER_MSG =
  'Dein Handshake liegt auf der Chain, aber der Partner hat noch keinen Schlüssel zurückgesendet — verschlüsselt senden ist erst nach seiner Antwort möglich (nicht nur „Handshake senden“).'

/** Aktueller Produktzustand: verschlüsselter LoRa-Funk ist bewusst aus; Pfad 4 bleibt Klartext. */
export const CHAT_ENCRYPTED_MESH_DISABLED_MSG =
  'Verschlüsselter LoRa-Funk ist deaktiviert. Für Verschlüsselung: „online“ mit verbundenem Partner (Handshake/Connect). Für Einsatz-Protokoll: Pfad 4 nutzt Klartext-Funk + eigene Verankerung.'

export function isAttachedLoraDualComposerAllowed(p: {
  isPrivate: boolean
  encrypted: boolean
  forcedTransport: ForcedTransport
  meshLoRaImagesEnabled: boolean
}): boolean {
  void p.encrypted /* Mesh: Luft Klartext; Schloss betrifft nur Online-/Mailbox-Pfade. */
  if (!p.isPrivate) return false
  if (p.forcedTransport === 'internet' && p.encrypted) return true
  if (isLoRaMeshTransport(p.forcedTransport) && p.meshLoRaImagesEnabled) return true
  return false
}

export type MeshtasticBleSendApi = {
  connected: boolean
  sendBinaryV2: (
    raw: Uint8Array,
    destination?: number | 'broadcast',
    channelIndex?: number
  ) => Promise<unknown>
  /** Klartext über Meshtastic (TEXT_MESSAGE_APP). `destination` = Knoten-Nummer oder Broadcast. */
  sendMeshText: (
    text: string,
    destination?: number | 'broadcast',
    channelIndex?: number
  ) => Promise<unknown>
}
