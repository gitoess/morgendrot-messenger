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
  readonly connect: () => Promise<void>
  readonly connectBluetooth: () => Promise<void>
  readonly connectUsb: () => Promise<void>
  readonly disconnect: () => void
  readonly sendMeshText: (
    text: string,
    destination?: number | 'broadcast',
    channelIndex?: number
  ) => Promise<number>
}

export function asMeshDevice(device: MeshDevicePort): MeshDevicePort {
  return device
}
