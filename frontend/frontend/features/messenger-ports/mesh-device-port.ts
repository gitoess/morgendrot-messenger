import type { MeshtasticVisibleNode } from '@/frontend/lib/meshtastic-visible-nodes'
import type { MeshtasticRadioChannel } from '@/frontend/lib/meshtastic-radio-channels'

/** Meshtastic-Gerät: Verbindung + Senden (P6). */
export type MeshDevicePort = {
  readonly bleSupported: boolean
  readonly serialSupported: boolean
  readonly transportKind: 'bluetooth' | 'usb'
  readonly setTransportKind: (kind: 'bluetooth' | 'usb') => void
  readonly connected: boolean
  readonly connecting: boolean
  readonly error: string | null
  readonly lastRxDebug: string | null
  readonly meshRxSubscriptions: string | null
  /** Live NodeDB (ohne Self), für Empfänger-Auswahl. */
  readonly visibleNodes: readonly MeshtasticVisibleNode[]
  /** Kanäle vom Radio (Name/Rolle/Index) — PSK nur als hasPsk-Flag. */
  readonly radioChannels: readonly MeshtasticRadioChannel[]
  readonly connect: () => Promise<void>
  readonly connectBluetooth: () => Promise<void>
  readonly connectUsb: () => Promise<void>
  readonly disconnect: () => void
  /** WantConfig erneut — Nodes/Kanäle vom Radio. */
  readonly refreshMeshDirectory: () => Promise<void>
  readonly sendMeshText: (
    text: string,
    destination?: number | 'broadcast',
    channelIndex?: number,
    opts?: { wantAck?: boolean; isCancelled?: () => boolean; queueConfirm?: boolean }
  ) => Promise<unknown>
  /** Optional: stiller Reconnect (USB getPorts / BLE sticky). */
  readonly ensureConnected?: () => Promise<boolean>
}

export function asMeshDevice(device: MeshDevicePort): MeshDevicePort {
  return device
}
