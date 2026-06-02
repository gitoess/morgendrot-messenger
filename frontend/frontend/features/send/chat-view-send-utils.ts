'use client'

/**
 * Validierungen vor dem Absenden (UTF-8-Grenzen, Audio-Wire, Mesh vs. IOTA-Kompaktblob).
 */

import {
  wireUtf8ByteLength,
  MESSAGING_WIRE_UTF8_MAX,
  morgAudioWirePassesLimits,
  MEDIA_IOTA_AUDIO_RAW_MAX_BYTES,
  MEDIA_LORA_AUDIO_RAW_MAX_BYTES,
  MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES,
  parseCompactImageMessage,
  decodedBase64BinaryLength,
} from '@/frontend/lib/compact-image-wire'
import {
  CHAT_LORA_DUAL_IMAGE_POLICY_MSG,
  type ForcedTransport,
} from '@/frontend/lib/chat-view-messenger-transport'
import { stripLeadingMorgEmergencyV1Marker } from '@/frontend/lib/morg-emergency-v1-text'

export type ChatSendValidation = { ok: true } | { ok: false; message: string; idleMs?: number }

/** Zusätzliche JS-String-Länge (Zeichen), bevor der Browser/API stark leidet. */
export const CHAT_OUTGOING_JS_CHAR_SOFT_MAX = 700_000

export function validateLoraDualWireUtf8(lumaText: string, chromaText: string): ChatSendValidation {
  if (
    wireUtf8ByteLength(lumaText) > MESSAGING_WIRE_UTF8_MAX ||
    wireUtf8ByteLength(chromaText) > MESSAGING_WIRE_UTF8_MAX
  ) {
    return {
      ok: false,
      message: `LoRa-Wire zu lang (>${MESSAGING_WIRE_UTF8_MAX} Byte UTF-8 pro Paket). Kürzeren Text oder anderes Bild.`,
      idleMs: 6000,
    }
  }
  return { ok: true }
}

export function validateMeshDisallowsIotaCompactBlob(
  forcedTransport: ForcedTransport,
  attachedBlobBase64: string | null
): ChatSendValidation {
  if (forcedTransport === 'mesh' && attachedBlobBase64) {
    return {
      ok: false,
      message: `Funk: IOTA-Kompakt-Bild passt hier nicht (kein automatischer LoRa-Zweiteiler ohne erlaubte Kombination). ${CHAT_LORA_DUAL_IMAGE_POLICY_MSG}`,
      idleMs: 9000,
    }
  }
  return { ok: true }
}

export function validateStandardOutgoingWire(
  textSnap: string,
  ctx: {
    hasAttachedAudio: boolean
    forcedTransport?: ForcedTransport
  }
): ChatSendValidation {
  if (ctx.hasAttachedAudio) {
    const maxRaw =
      ctx.forcedTransport === 'mesh' ? MEDIA_LORA_AUDIO_RAW_MAX_BYTES : MEDIA_IOTA_AUDIO_RAW_MAX_BYTES
    const em = stripLeadingMorgEmergencyV1Marker(textSnap)
    const wireForAudio = em.emergency ? em.body : textSnap
    const audioLim = morgAudioWirePassesLimits(wireForAudio, { maxRawBinaryBytes: maxRaw })
    if (!audioLim.ok) {
      const hint =
        ctx.forcedTransport === 'mesh'
          ? ' Für Funk: kurzes Opus (≈≤10 s).'
          : ''
      return { ok: false, message: `${audioLim.reason}${hint}`, idleMs: 6000 }
    }
  }
  const compactImg = parseCompactImageMessage(textSnap)
  if (compactImg) {
    const net = decodedBase64BinaryLength(compactImg.blobBase64)
    if (net > MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES) {
      return {
        ok: false,
        message: `Kompakt-Bild-Blob zu groß (${net} B, max. ${MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES} B). Bild erneut anhängen – die Geräte-Kodierung muss das Motiv verkleinern.`,
        idleMs: 7000,
      }
    }
  }
  if (wireUtf8ByteLength(textSnap) > MESSAGING_WIRE_UTF8_MAX) {
    return {
      ok: false,
      message: `Nachricht zu lang für die Chain (>${MESSAGING_WIRE_UTF8_MAX} Byte UTF-8). Kürzeren Text oder kleineres Bild/Audio.`,
      idleMs: 5000,
    }
  }
  if (textSnap.length > CHAT_OUTGOING_JS_CHAR_SOFT_MAX) {
    return {
      ok: false,
      message:
        'Nachricht zu groß (~700k Zeichen). Kompaktes Bild ist für IOTA/Mailbox oft noch ok; bei Mesh ggf. kleineres Foto wählen.',
      idleMs: 5000,
    }
  }
  return { ok: true }
}
