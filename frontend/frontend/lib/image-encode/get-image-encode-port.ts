'use client'

import { createRelayImageEncodePort } from '@/frontend/lib/image-encode/relay-lora-fluent-backend'
import { createWasmImageEncodePort } from '@/frontend/lib/image-encode/wasm-lora-fluent-backend'
import type {
  ImageEncodePort,
  IotaCompactEncodeResult,
  LoRaFluentEncodeResult,
} from '@/frontend/lib/image-encode/image-encode-port'
import { isImageEncodeRelayFallbackEnabled } from '@/frontend/lib/image-encode/relay-lora-fluent-backend'

let wasmPort: ImageEncodePort | null = null

export function getWasmImageEncodePort(): ImageEncodePort {
  if (!wasmPort) wasmPort = createWasmImageEncodePort()
  return wasmPort
}

/**
 * Standard: **WASM auf dem Gerät**. Optional Relay, wenn `morgendrot.imageEncodeRelayFallback=1`.
 */
export async function encodeLoRaFluentAutark(
  dataUrl: string,
  opts?: { maxTotalBytes?: number }
): Promise<LoRaFluentEncodeResult> {
  const wasm = getWasmImageEncodePort()
  const local = await wasm.encodeLoRaFluent(dataUrl, opts)
  if (local.ok) return local
  if (!isImageEncodeRelayFallbackEnabled()) {
    return {
      ok: false,
      error: `${local.error} (Lokal — ohne PC/Server. Optional Relay: localStorage „${'morgendrot.imageEncodeRelayFallback'}“ = 1.)`,
    }
  }
  const relay = createRelayImageEncodePort()
  const remote = await relay.encodeLoRaFluent(dataUrl, opts)
  if (!remote.ok) {
    return {
      ok: false,
      error: `Lokal: ${local.error} — Relay: ${remote.error}`,
    }
  }
  return remote
}

/**
 * Standard: **WASM auf dem Gerät** für `MORG_COMPACT_IMG_V1`. Optional Relay bei `morgendrot.imageEncodeRelayFallback=1`.
 */
export async function encodeIotaCompactAutark(
  dataUrl: string,
  opts?: { maxPlaintextBytes?: number }
): Promise<IotaCompactEncodeResult> {
  const wasm = getWasmImageEncodePort()
  const local = await wasm.encodeIotaCompact(dataUrl, opts)
  if (local.ok) return local
  if (!isImageEncodeRelayFallbackEnabled()) {
    return {
      ok: false,
      error: `${local.error} (Lokal — ohne PC/Server. Optional Relay: localStorage „morgendrot.imageEncodeRelayFallback“ = 1.)`,
    }
  }
  const relay = createRelayImageEncodePort()
  const remote = await relay.encodeIotaCompact(dataUrl, opts)
  if (!remote.ok) {
    return {
      ok: false,
      error: `Lokal: ${local.error} — Relay: ${remote.error}`,
    }
  }
  return remote
}
