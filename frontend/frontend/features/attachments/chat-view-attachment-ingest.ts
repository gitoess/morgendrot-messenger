'use client'

/**
 * Datei → Anhang-Zustand (Bild/IOTA-Kompakt, LoRa-Zweiphasen, .txt, Opus).
 * Ohne React; Delayed Upload kann dieselben Grenzen/Probes nutzen.
 */

import { compactImageEncode, loraProgressiveEncode } from '@/frontend/lib/api'
import {
  wrapFileTxtMessage,
  wrapMorgAudioV1Message,
  wireUtf8ByteLength,
  MESSAGING_WIRE_UTF8_MAX,
  morgAudioWirePassesLimits,
  MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES,
  MEDIA_IOTA_AUDIO_RAW_MAX_BYTES,
  MEDIA_LORA_AUDIO_RAW_MAX_BYTES,
} from '@/frontend/lib/compact-image-wire'
import { isLoRaMeshTransport, type ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'

export const CHAT_ATTACHMENT_MAX_RAW_IMAGE_BYTES = 12 * 1024 * 1024

export type CompactAttachmentMeta = {
  total: number
  luma: number
  chroma: number
  q: number
  mode?: 'iota' | 'lora'
}

export type AttachmentIngestFailure = { ok: false; message: string; idleMs?: number }

export type AttachmentIngestSuccess = {
  ok: true
  /** Nach erfolgreichem Import (z. B. Rohbild über IOTA-Nettoziel, Kodierung passt). */
  softWarning?: string
  attachedBlobBase64: string | null
  attachedTxtFile: { name: string; text: string } | null
  attachedAudioBase64: string | null
  attachedLora: ChatAttachedLora | null
  compactMeta: CompactAttachmentMeta
}

function isTxtFile(file: File): boolean {
  return file.type === 'text/plain' || /\.txt$/i.test(file.name)
}

/** Einige Browser/Geräte liefern bei Drag&Drop leeren `type` – Endung als Fallback. */
function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name)
}

function isLikelyOpusFile(file: File): boolean {
  return (
    /\.opus$/i.test(file.name) ||
    /\.ogg$/i.test(file.name) ||
    file.type === 'audio/ogg' ||
    file.type === 'audio/opus' ||
    file.type === 'application/ogg' ||
    file.type === 'video/ogg'
  )
}

export function validateCompactPickFileType(file: File): AttachmentIngestFailure | null {
  const isTxt = isTxtFile(file)
  const isLikelyOpus = isLikelyOpusFile(file)
  const isImage = isLikelyImageFile(file)
  if (!isImage && !isTxt && !isLikelyOpus) {
    return {
      ok: false,
      message:
        'Unterstützt: Bilder (.jpg, .png, .webp, …), Text (.txt) oder Opus/Ogg (.opus, .ogg). PDF folgt später.',
      idleMs: 5000,
    }
  }
  return null
}

async function ingestOpus(
  file: File,
  forcedTransport: ForcedTransport
): Promise<AttachmentIngestFailure | AttachmentIngestSuccess> {
  const buf = await file.arrayBuffer()
  const u8 = new Uint8Array(buf)
  const magic = String.fromCharCode(u8[0] ?? 0, u8[1] ?? 0, u8[2] ?? 0, u8[3] ?? 0)
  if (u8.length < 4 || magic !== 'OggS') {
    return {
      ok: false,
      message: 'Erwartet Ogg-Container (Magic „OggS“), typisch für .opus.',
      idleMs: 5000,
    }
  }
  const maxRaw = isLoRaMeshTransport(forcedTransport) ? MEDIA_LORA_AUDIO_RAW_MAX_BYTES : MEDIA_IOTA_AUDIO_RAW_MAX_BYTES
  if (u8.length > maxRaw) {
    return {
      ok: false,
      message: isLoRaMeshTransport(forcedTransport)
        ? `Für Funk (LoRa) max. ca. ${Math.round(MEDIA_LORA_AUDIO_RAW_MAX_BYTES / 1024)} KiB Opus (~8–12 s bei 6–8 kbit/s). Datei hat ${u8.length} B — bitte kürzer kodieren.`
        : 'Sprachdatei zu groß für IOTA (max. 75 KB).',
      idleMs: 7000,
    }
  }
  const { uint8ArrayToBase64 } = await import('@/frontend/lib/emergency-binary-browser')
  const b64 = uint8ArrayToBase64(u8)
  const probe = wrapMorgAudioV1Message(b64, undefined)
  const lim = morgAudioWirePassesLimits(probe, {
    maxRawBinaryBytes: maxRaw,
    maxWireUtf8Bytes: MESSAGING_WIRE_UTF8_MAX,
  })
  if (!lim.ok) {
    const msg =
      !isLoRaMeshTransport(forcedTransport) && /Rohdaten zu groß/i.test(lim.reason)
        ? 'Sprachdatei zu groß für IOTA (max. 75 KB).'
        : lim.reason
    return { ok: false, message: msg, idleMs: 6000 }
  }
  return {
    ok: true,
    attachedBlobBase64: null,
    attachedTxtFile: null,
    attachedAudioBase64: b64,
    attachedLora: null,
    compactMeta: { total: u8.length, luma: 0, chroma: 0, q: 0 },
  }
}

async function ingestTxt(file: File): Promise<AttachmentIngestFailure | AttachmentIngestSuccess> {
  const text = await file.text()
  const wireProbe = wrapFileTxtMessage(file.name, text, undefined)
  const softWarning =
    wireUtf8ByteLength(wireProbe) > 16_000
      ? 'Große .txt-Datei: Beim Senden wird sie automatisch in mehrere Nachrichten aufgeteilt.'
      : undefined
  return {
    ok: true,
    softWarning,
    attachedBlobBase64: null,
    attachedTxtFile: { name: file.name, text },
    attachedAudioBase64: null,
    attachedLora: null,
    compactMeta: {
      total: new TextEncoder().encode(text).length,
      luma: 0,
      chroma: 0,
      q: 0,
    },
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'))
    r.readAsDataURL(file)
  })
}

async function ingestImage(
  file: File,
  forcedTransport: ForcedTransport
): Promise<AttachmentIngestFailure | AttachmentIngestSuccess> {
  if (file.size > CHAT_ATTACHMENT_MAX_RAW_IMAGE_BYTES) {
    return {
      ok: false,
      message: 'Bild zu groß (max. 12 MB Rohdatei).',
      idleMs: 4000,
    }
  }
  const dataUrl = await readFileAsDataUrl(file)
  /** Funk: ausschließlich progressive LoRa-JPEG-Zweiteiler – nie `MORG_COMPACT_IMG_V1`. */
  if (isLoRaMeshTransport(forcedTransport)) {
    const enc = await loraProgressiveEncode(dataUrl)
    if (!enc.ok || !enc.lumaWire || !enc.chromaWire) {
      return {
        ok: false,
        message:
          enc.error ||
          'LoRa-Kodierung fehlgeschlagen (Backend POST /api/lora-progressive-encode, Sharp?).',
        idleMs: 6000,
      }
    }
    const lora: ChatAttachedLora = {
      lumaWire: enc.lumaWire,
      chromaWire: enc.chromaWire,
      messageId: enc.messageId ?? '',
      lumaJpegBytes: enc.lumaJpegBytes ?? 0,
      chromaJpegBytes: enc.chromaJpegBytes ?? 0,
    }
    return {
      ok: true,
      attachedBlobBase64: null,
      attachedTxtFile: null,
      attachedAudioBase64: null,
      attachedLora: lora,
      compactMeta: {
        total: (enc.lumaJpegBytes ?? 0) + (enc.chromaJpegBytes ?? 0),
        luma: enc.lumaJpegBytes ?? 0,
        chroma: enc.chromaJpegBytes ?? 0,
        q: 0,
        mode: 'lora',
      },
    }
  }
  /** Online / IOTA: ein Wire `MORG_COMPACT_IMG_V1`, höheres Blob-Budget als Audio (siehe Messenger-Chain-Limit). */
  const enc = await compactImageEncode(dataUrl, { maxPlaintextBytes: MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES })
  if (!enc.ok || !enc.blobBase64) {
    return {
      ok: false,
      message:
        enc.error ||
        'Kompakt-Kodierung fehlgeschlagen (Backend erreichbar? Sharp installiert?). Zum **Senden** der Nachricht ist weiterhin Wallet-Unlock nötig.',
      idleMs: 5000,
    }
  }
  const packed = enc.totalBytes ?? 0
  if (packed > MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES) {
    return {
      ok: false,
      message: `Bild zu groß für IOTA (${packed} B nach Kodierung, max. ${MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES} B).`,
      idleMs: 6000,
    }
  }
  const rawOverIotaTarget = file.size > MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES
  return {
    ok: true,
    softWarning: rawOverIotaTarget
      ? 'Bild zu groß für IOTA – wird automatisch verkleinert.'
      : undefined,
    attachedBlobBase64: enc.blobBase64,
    attachedTxtFile: null,
    attachedAudioBase64: null,
    attachedLora: null,
    compactMeta: {
      total: enc.totalBytes ?? 0,
      luma: enc.lumaBytes ?? 0,
      chroma: enc.chromaBytes ?? 0,
      q: enc.usedQuality ?? 0,
      mode: 'iota',
    },
  }
}

/**
 * Vollständiger Pick-Pfad wie in der UI (eine Datei).
 */
export async function ingestCompactAttachmentPick(
  file: File,
  ctx: { role: string; forcedTransport: ForcedTransport; transportOverride?: ForcedTransport }
): Promise<AttachmentIngestFailure | AttachmentIngestSuccess> {
  const typeErr = validateCompactPickFileType(file)
  if (typeErr) return typeErr

  const t = ctx.transportOverride ?? ctx.forcedTransport

  if (isLikelyOpusFile(file)) {
    return ingestOpus(file, t)
  }

  if (isTxtFile(file)) {
    return ingestTxt(file)
  }

  try {
    return await ingestImage(file, t)
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      idleMs: 4000,
    }
  }
}
