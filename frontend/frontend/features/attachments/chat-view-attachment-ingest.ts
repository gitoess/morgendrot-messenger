'use client'

/**
 * Datei → Anhang-Zustand (Bild/IOTA-Kompakt, LoRa-Zweiphasen, .txt, Opus).
 * Ohne React; Delayed Upload kann dieselben Grenzen/Probes nutzen.
 */

import { encodeIotaCompactAutark, encodeLoRaFluentAutark } from '@/frontend/lib/image-encode/get-image-encode-port'
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
import {
  CHAT_LORA_DUAL_IMAGE_POLICY_MSG,
  isAttachedLoraDualComposerAllowed,
  isLoRaMeshTransport,
  type ForcedTransport,
} from '@/frontend/lib/chat-view-messenger-transport'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import { FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES } from '@/frontend/lib/lora-image-morg-seg-v1-limits'

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
  if (isLoRaMeshTransport(forcedTransport)) {
    return {
      ok: false,
      message:
        'Sprachnachricht ist aktuell nur für Online/IOTA aktiv. Für Funk bitte SOS-Text (Diktat) oder Kurztext nutzen.',
      idleMs: 7000,
    }
  }
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
  forcedTransport: ForcedTransport,
  policy: { isPrivate: boolean; encrypted: boolean; meshLoRaImagesEnabled: boolean }
): Promise<AttachmentIngestFailure | AttachmentIngestSuccess> {
  if (file.size > CHAT_ATTACHMENT_MAX_RAW_IMAGE_BYTES) {
    return {
      ok: false,
      message: 'Bild zu groß (max. 12 MB Rohdatei).',
      idleMs: 4000,
    }
  }
  const dataUrl = await readFileAsDataUrl(file)
  /** Funk: LUMA+CHROMA nur bei Pfad 4 (Klartext); sonst kein Anhang. */
  if (isLoRaMeshTransport(forcedTransport)) {
    if (
      !isAttachedLoraDualComposerAllowed({
        isPrivate: policy.isPrivate,
        encrypted: policy.encrypted,
        forcedTransport,
        meshLoRaImagesEnabled: policy.meshLoRaImagesEnabled,
      })
    ) {
      return { ok: false, message: CHAT_LORA_DUAL_IMAGE_POLICY_MSG, idleMs: 9000 }
    }
    const rawOverLoRaCap = file.size > FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES
    const enc = await encodeLoRaFluentAutark(dataUrl, {
      maxTotalBytes: FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES,
    })
    if (!enc.ok) {
      return {
        ok: false,
        message: enc.error || 'LoRa-Bild-Kodierung auf dem Gerät fehlgeschlagen.',
        idleMs: 8000,
      }
    }
    const lumaB = enc.lumaJpegBytes
    const chromaB = enc.chromaJpegBytes
    const totalLoRa = lumaB + chromaB
    if (totalLoRa > FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES) {
      return {
        ok: false,
        message: `LoRa-Bild nach Kompression noch zu groß (${Math.round(totalLoRa / 1024)} KB). Bitte erneut importieren oder anderes Motiv.`,
        idleMs: 10_000,
      }
    }
    const lora: ChatAttachedLora = {
      lumaWire: enc.lumaWire,
      chromaWire: enc.chromaWire,
      messageId: enc.messageId ?? '',
      lumaJpegBytes: lumaB,
      chromaJpegBytes: chromaB,
    }
    return {
      ok: true,
      softWarning: rawOverLoRaCap
        ? `Bild wird für Funk (Flüchtig) auf dem Gerät verkleinert (max. ${Math.round(FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES / 1024)} KB, MozJPEG WASM — ohne PC/Server).`
        : enc.encoder === 'wasm'
          ? 'LoRa-Bild lokal kodiert (Gerät, ohne Morgendrot-API).'
          : undefined,
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
  /** Online / IOTA: ein Wire `MORG_COMPACT_IMG_V1` — lokal (WebP WASM + PNG), ohne Pflicht-Node. */
  const enc = await encodeIotaCompactAutark(dataUrl, {
    maxPlaintextBytes: MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES,
  })
  if (!enc.ok) {
    return {
      ok: false,
      message: enc.error || 'IOTA-Bild-Kodierung auf dem Gerät fehlgeschlagen.',
      idleMs: 8000,
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
      ? `Bild wird für IOTA auf dem Gerät verkleinert (max. ${Math.round(MEDIA_COMPACT_IMAGE_BLOB_MAX_BYTES / 1024)} KB Netto, ohne PC/Server).`
      : enc.encoder === 'wasm'
        ? 'IOTA-Bild lokal kodiert (Gerät, ohne Morgendrot-API).'
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
  ctx: {
    role: string
    forcedTransport: ForcedTransport
    transportOverride?: ForcedTransport
    isPrivate: boolean
    encrypted: boolean
    meshLoRaImagesEnabled: boolean
  }
): Promise<AttachmentIngestFailure | AttachmentIngestSuccess> {
  const typeErr = validateCompactPickFileType(file)
  if (typeErr) return typeErr

  const t = ctx.transportOverride ?? ctx.forcedTransport
  const policy = {
    isPrivate: ctx.isPrivate,
    encrypted: ctx.encrypted,
    meshLoRaImagesEnabled: ctx.meshLoRaImagesEnabled,
  }

  if (isLikelyOpusFile(file)) {
    return ingestOpus(file, t)
  }

  if (isTxtFile(file)) {
    return ingestTxt(file)
  }

  try {
    return await ingestImage(file, t, policy)
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      idleMs: 4000,
    }
  }
}
