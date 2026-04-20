'use client'

import { meshBuildV2Wires } from '@/frontend/lib/api'
import { base64ToUint8Array } from '@/frontend/lib/emergency-binary-browser'

/**
 * Pause zwischen zwei Mesh-v2-Frames über Web-BT: reduziert Überlastung von GATT/ESP beim Burst
 * (Phase B Stabilität). Bei Bedarf 0 setzen (z. B. Tests).
 */
export const MESH_V2_BURST_INTER_PACKET_MS_DEFAULT = 80

export type SendMeshV2WireBurstOptions = {
  /** Millisekunden Wartezeit vor dem nächsten Paket (nach dem ersten). Default siehe Konstante. */
  interPacketDelayMs?: number
  /**
   * B1 SOS: `MacroPriorityClass.Flash` — Burst ohne Pausen zwischen MF1-Fragmenten (App-seitig; Meshtastic selbst priorisiert nicht).
   */
  priorityFlash?: boolean
  /**
   * Vor Wire-Build und vor jedem ausgehenden Paket — z. B. `throw` bei Nutzer-Abbruch.
   */
  beforeEachPacket?: () => void
}

/**
 * Baut Mesh-v2-Wires für `text` und sendet sie nacheinander per Meshtastic BINARY v2 (Broadcast).
 */
export async function sendMeshV2WireBurst(
  text: string,
  sendBinaryV2: (raw: Uint8Array, destination?: number | 'broadcast') => Promise<unknown>,
  onProgress?: (sent: number, total: number) => void,
  options?: SendMeshV2WireBurstOptions
): Promise<void> {
  const inter = options?.priorityFlash
    ? 0
    : options?.interPacketDelayMs !== undefined
      ? options.interPacketDelayMs
      : MESH_V2_BURST_INTER_PACKET_MS_DEFAULT
  options?.beforeEachPacket?.()
  const b = await meshBuildV2Wires(text)
  if (!b.ok || !b.wires?.length) {
    const raw = b.error ?? b.message ?? 'Mesh-Build fehlgeschlagen'
    const err =
      typeof raw === 'string'
        ? raw
        : (() => {
            try {
              return JSON.stringify(raw)
            } catch {
              return String(raw)
            }
          })()
    if (/connect|peerMap|Nicht verbunden/i.test(err)) {
      throw new Error(
        `${err} — Verschlüsselter Funk (Mesh v2) braucht Handshake und /connect (Wallet). Alternativen: Klartext + „funk“ (Standard-Meshtastic-Text, ohne /connect) oder zuerst Partner verbinden.`
      )
    }
    throw new Error(err)
  }
  const total = b.wires.length
  for (let i = 0; i < b.wires.length; i++) {
    options?.beforeEachPacket?.()
    const raw = base64ToUint8Array(b.wires[i]!.wireBase64)
    await sendBinaryV2(raw, 'broadcast')
    onProgress?.(i + 1, total)
    if (i + 1 < total && inter > 0) {
      await new Promise((r) => setTimeout(r, inter))
    }
  }
}
