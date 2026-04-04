'use client'

import { meshBuildV2Wires } from '@/frontend/lib/api'
import { base64ToUint8Array } from '@/frontend/lib/emergency-binary-browser'

/**
 * Baut Mesh-v2-Wires für `text` und sendet sie nacheinander per Meshtastic BINARY v2 (Broadcast).
 */
export async function sendMeshV2WireBurst(
  text: string,
  sendBinaryV2: (raw: Uint8Array, destination?: number | 'broadcast') => Promise<unknown>,
  onProgress?: (sent: number, total: number) => void
): Promise<void> {
  const b = await meshBuildV2Wires(text)
  if (!b.ok || !b.wires?.length) {
    throw new Error(b.error || b.message || 'Mesh-Build fehlgeschlagen')
  }
  const total = b.wires.length
  for (let i = 0; i < b.wires.length; i++) {
    const raw = base64ToUint8Array(b.wires[i]!.wireBase64)
    await sendBinaryV2(raw, 'broadcast')
    onProgress?.(i + 1, total)
  }
}
