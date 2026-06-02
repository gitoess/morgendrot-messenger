/**
 * ImageEncodePort — lokale Bild-Kodierung ohne Morgendrot-Node (Handy-first).
 */

import type { IotaCompactEncodeOk as IotaCompactPacked, LoraProgressiveWireBundle } from '@morgendrot/core/image'
import { uint8ArrayToBase64 } from '@/frontend/lib/emergency-binary-browser'

export type LoRaFluentEncodeOk = {
  ok: true
  messageId: string
  lumaWire: string
  chromaWire: string
  lumaJpegBytes: number
  chromaJpegBytes: number
  encoder: 'wasm' | 'relay'
}

export type LoRaFluentEncodeFail = { ok: false; error: string }

export type LoRaFluentEncodeResult = LoRaFluentEncodeOk | LoRaFluentEncodeFail

export type IotaCompactEncodeOk = {
  ok: true
  blobBase64: string
  lumaBytes: number
  chromaBytes: number
  totalBytes: number
  usedQuality: number
  encoder: 'wasm' | 'relay'
}

export type IotaCompactEncodeFail = { ok: false; error: string }

export type IotaCompactEncodeResult = IotaCompactEncodeOk | IotaCompactEncodeFail

export type ImageEncodePort = {
  readonly id: 'wasm' | 'relay'
  encodeLoRaFluent(
    dataUrl: string,
    opts?: { maxTotalBytes?: number }
  ): Promise<LoRaFluentEncodeResult>
  encodeIotaCompact(
    dataUrl: string,
    opts?: { maxPlaintextBytes?: number }
  ): Promise<IotaCompactEncodeResult>
}

export function loraBundleToResult(bundle: LoraProgressiveWireBundle, encoder: 'wasm' | 'relay'): LoRaFluentEncodeOk {
  return {
    ok: true,
    messageId: bundle.messageId,
    lumaWire: bundle.lumaWire,
    chromaWire: bundle.chromaWire,
    lumaJpegBytes: bundle.lumaJpegBytes,
    chromaJpegBytes: bundle.chromaJpegBytes,
    encoder,
  }
}

export function iotaPackedToResult(packed: IotaCompactPacked, encoder: 'wasm' | 'relay'): IotaCompactEncodeOk {
  return {
    ok: true,
    blobBase64: uint8ArrayToBase64(packed.plaintext),
    lumaBytes: packed.lumaWebpBytes,
    chromaBytes: packed.chromaPngBytes,
    totalBytes: packed.plaintext.length,
    usedQuality: packed.usedQuality,
    encoder,
  }
}
