/**
 * Pfad 4 (MVP): Klartext per Meshtastic (LongFast), danach Kopie per Klartext-Mailbox an die eigene Adresse
 * (Tangle-Verankerung) + optionale Forensic-Attestation — **ohne** Mesh-v2/Peer-ECDH.
 */

export const MORG_PATH4_SELF_ARCHIVE_V1 = '[[MORG_PATH4_SELF_ARCHIVE_V1]]'

/** Nur für die Mailbox-Kopie (nicht für den LoRa-Lufttext). */
export function prependPath4SelfArchiveMarker(plaintext: string): string {
  const t = plaintext.trimStart()
  if (t.startsWith(MORG_PATH4_SELF_ARCHIVE_V1)) return plaintext
  return `${MORG_PATH4_SELF_ARCHIVE_V1}\n${plaintext}`
}
