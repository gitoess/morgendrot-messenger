'use client'

import { compactImageEncode, loraProgressiveEncode } from '@/frontend/lib/api'
import {
  type ImageEncodePort,
  type LoRaFluentEncodeResult,
} from '@/frontend/lib/image-encode/image-encode-port'

const RELAY_FALLBACK_KEY = 'morgendrot.imageEncodeRelayFallback'

/** Optional: Relay nur wenn explizit aktiviert (Boss/deployed). Standard: rein lokal. */
export function isImageEncodeRelayFallbackEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(RELAY_FALLBACK_KEY) === '1'
  } catch {
    return false
  }
}

export function createRelayImageEncodePort(): ImageEncodePort {
  return {
    id: 'relay',
    encodeIotaCompact: async (dataUrl, opts) => {
      const enc = await compactImageEncode(dataUrl, {
        fitLuma: true,
        maxPlaintextBytes: opts?.maxPlaintextBytes,
      })
      if (!enc.ok || !enc.blobBase64) {
        return { ok: false, error: enc.error ?? 'IOTA-Bild-Kodierung (Relay) fehlgeschlagen.' }
      }
      return {
        ok: true,
        blobBase64: enc.blobBase64,
        lumaBytes: enc.lumaBytes ?? 0,
        chromaBytes: enc.chromaBytes ?? 0,
        totalBytes: enc.totalBytes ?? 0,
        usedQuality: enc.usedQuality ?? 0,
        encoder: 'relay',
      }
    },
    encodeLoRaFluent: async (dataUrl, opts) => {
      const enc = await loraProgressiveEncode(dataUrl, {
        maxTotalBytes: opts?.maxTotalBytes,
        segmented: true,
      })
      if (!enc.ok || !enc.lumaWire || !enc.chromaWire) {
        return { ok: false, error: enc.error ?? 'LoRa-Kodierung (Relay) fehlgeschlagen.' }
      }
      return {
        ok: true,
        messageId: enc.messageId ?? '',
        lumaWire: enc.lumaWire,
        chromaWire: enc.chromaWire,
        lumaJpegBytes: enc.lumaJpegBytes ?? 0,
        chromaJpegBytes: enc.chromaJpegBytes ?? 0,
        encoder: 'relay',
      }
    },
  }
}
