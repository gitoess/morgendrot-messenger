import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

/** Luma+Chroma kompakt (Server/sharp) – braucht entsperrtes Wallet. */
export async function compactImageEncode(
  imageBase64: string,
  options?: {
    fitLuma?: boolean
    lumaQuality?: number
    targetLumaBytes?: number
    /** Netto-Blob-Limit für `MORG_COMPACT_IMG_V1` (Default: Server `MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES`, z. B. 11800). */
    maxPlaintextBytes?: number
  }
): Promise<{
  ok: boolean
  blobBase64?: string
  lumaBytes?: number
  chromaBytes?: number
  totalBytes?: number
  sha256Hex?: string
  usedQuality?: number
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/compact-image-encode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        fitLuma: options?.fitLuma !== false,
        lumaQuality: options?.lumaQuality,
        targetLumaBytes: options?.targetLumaBytes,
        maxPlaintextBytes: options?.maxPlaintextBytes,
      }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Bildkodierung fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    if (typeof b.blobBase64 !== 'string' || !b.blobBase64.length) {
      return { ok: false, error: 'Unerwartete Encoder-Antwort (blobBase64).' }
    }
    return {
      ok: true,
      blobBase64: b.blobBase64,
      lumaBytes: typeof b.lumaBytes === 'number' ? b.lumaBytes : undefined,
      chromaBytes: typeof b.chromaBytes === 'number' ? b.chromaBytes : undefined,
      totalBytes: typeof b.totalBytes === 'number' ? b.totalBytes : undefined,
      sha256Hex: typeof b.sha256Hex === 'string' ? b.sha256Hex : undefined,
      usedQuality: typeof b.usedQuality === 'number' ? b.usedQuality : undefined,
    }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

/**
 * IOTA-`MORG_COMPACT_IMG_V1`-Netto-Blob (wie `attachedBlobBase64` im Composer) → LUMA+CHROMA-Wires für Funk.
 * Server: Dekodieren → PNG → `prepareImageForLoRa`.
 */
export async function loraProgressiveFromCompactBlob(compactBlobBase64: string): Promise<{
  ok: boolean
  messageId?: string
  lumaWire?: string
  chromaWire?: string
  lumaJpegBytes?: number
  chromaJpegBytes?: number
  lumaWireUtf8Bytes?: number
  chromaWireUtf8Bytes?: number
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/compact-blob-to-lora-wires', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compactBlobBase64: compactBlobBase64.replace(/\s/g, '') }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'LoRa-Umwandlung fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    if (
      typeof b.messageId !== 'string' ||
      typeof b.lumaWire !== 'string' ||
      typeof b.chromaWire !== 'string'
    ) {
      return { ok: false, error: 'Unerwartete Antwort (LoRa aus Kompakt-Blob).' }
    }
    return {
      ok: true,
      messageId: b.messageId,
      lumaWire: b.lumaWire,
      chromaWire: b.chromaWire,
      lumaJpegBytes: typeof b.lumaJpegBytes === 'number' ? b.lumaJpegBytes : undefined,
      chromaJpegBytes: typeof b.chromaJpegBytes === 'number' ? b.chromaJpegBytes : undefined,
      lumaWireUtf8Bytes: typeof b.lumaWireUtf8Bytes === 'number' ? b.lumaWireUtf8Bytes : undefined,
      chromaWireUtf8Bytes: typeof b.chromaWireUtf8Bytes === 'number' ? b.chromaWireUtf8Bytes : undefined,
    }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

/** Zweiphasig Luma+Chroma für Funk/Mesh (scharfes S/W + optionale Farbe) – kein IOTA-Kompaktformat. */
export async function loraProgressiveEncode(
  imageBase64: string,
  options?: {
    /** § H.25a: Ziel LUMA+CHROMA Rohbytes (Default Server 12 KB). */
    maxTotalBytes?: number
    /** `true` = `prepareImageForLoRaFluentRobust` (Chunking, kein 500-B-Wire-Deckel). */
    segmented?: boolean
  }
): Promise<{
  ok: boolean
  messageId?: string
  lumaWire?: string
  chromaWire?: string
  lumaJpegBytes?: number
  chromaJpegBytes?: number
  lumaWireUtf8Bytes?: number
  chromaWireUtf8Bytes?: number
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/lora-progressive-encode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        ...(options?.maxTotalBytes != null ? { maxTotalBytes: options.maxTotalBytes } : {}),
        ...(options?.segmented ? { segmented: true } : {}),
      }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'LoRa-Kodierung fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    if (
      typeof b.messageId !== 'string' ||
      typeof b.lumaWire !== 'string' ||
      typeof b.chromaWire !== 'string'
    ) {
      return { ok: false, error: 'Unerwartete LoRa-Encoder-Antwort.' }
    }
    return {
      ok: true,
      messageId: b.messageId,
      lumaWire: b.lumaWire,
      chromaWire: b.chromaWire,
      lumaJpegBytes: typeof b.lumaJpegBytes === 'number' ? b.lumaJpegBytes : undefined,
      chromaJpegBytes: typeof b.chromaJpegBytes === 'number' ? b.chromaJpegBytes : undefined,
      lumaWireUtf8Bytes: typeof b.lumaWireUtf8Bytes === 'number' ? b.lumaWireUtf8Bytes : undefined,
      chromaWireUtf8Bytes: typeof b.chromaWireUtf8Bytes === 'number' ? b.chromaWireUtf8Bytes : undefined,
    }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

/** Luma+Chroma-JPEG → ein JPEG (Backend sharp `composite` blend `over`). */
export async function loraProgressiveFuse(
  lumaJpegBase64: string,
  chromaJpegBase64: string
): Promise<{ ok: boolean; fusedJpegBase64?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/lora-progressive-fuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lumaJpegBase64, chromaJpegBase64 }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'LoRa-Zusammenführung fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    if (typeof b.fusedJpegBase64 !== 'string' || !b.fusedJpegBase64.length) {
      return { ok: false, error: 'Unerwartete Fuse-Antwort.' }
    }
    return { ok: true, fusedJpegBase64: b.fusedJpegBase64 }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

/**
 * MediaRecorder-Rohblob → Ogg/Opus (ffmpeg auf dem Backend, z. B. CM4). Kein Wallet.
 */
export async function messengerAudioToOpus(
  audioBase64: string,
  mimeType: string
): Promise<{ ok: boolean; opusBase64?: string; bytes?: number; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/messenger-audio-to-opus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Audio-Transkodierung fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    if (typeof b.opusBase64 !== 'string' || !b.opusBase64.length) {
      return { ok: false, error: 'Unerwartete Opus-Antwort.' }
    }
    return {
      ok: true,
      opusBase64: b.opusBase64,
      bytes: typeof b.bytes === 'number' ? b.bytes : undefined,
    }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
