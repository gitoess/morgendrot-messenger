'use client'

/**
 * Einheitliche **Anzeige** von Chat-Klartext: Delay-Mirror-Marker entfernen, SOS-Marker → Präfix `[SOS]`.
 * Mailbox (IOTA) und Mesh-Empfang nutzen dieselbe Normalisierung.
 */

import { stripDelayMirrorMarker } from '@/frontend/features/send/mesh-delayed-upload'
import { stripLeadingMorgEmergencyV1Marker } from '@/frontend/lib/morg-emergency-v1-text'
import { tryParseMorgSosAckV1Plaintext } from '@/frontend/lib/morg-sos-ack-wire'
import { stripPinnwandPostMarker } from '@/frontend/lib/pinnwand-post-marker'

export function formatSosVisibleContent(plaintext: string): string {
  const e = stripLeadingMorgEmergencyV1Marker(plaintext)
  if (e.emergency) {
    return e.body ? `[SOS] ${e.body}` : '[SOS]'
  }
  return plaintext
}

/** Delay-Mirror-Zeile (falls vorne) entfernen, danach SOS für UI. */
export function normalizeChatMessageContentForDisplay(plaintext: string): string {
  let t = plaintext
  const d = stripDelayMirrorMarker(t)
  if (d.mirrored) {
    t = d.body
  }
  const ackD = tryParseMorgSosAckV1Plaintext(t)
  if (ackD) {
    return `[SOS-Bestätigung · …${ackD.slice(-8)}]`
  }
  t = stripPinnwandPostMarker(t)
  return formatSosVisibleContent(t)
}
