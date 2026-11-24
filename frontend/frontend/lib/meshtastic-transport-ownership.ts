/**
 * Ein Heltec-COM-Port hat genau einen Besitzer (Web Serial / Meshtastic-App / CLI).
 * Radio-Config bleibt in der Meshtastic-App; Morgendrot = Chat-Session.
 */

export const MESHTASTIC_OWNERSHIP_HINT =
  'Einstellungen (Region, Kanal, PSK): Meshtastic-App oder client.meshtastic.org — vorher USB dort trennen. Chat am PC: USB verbinden, wenn der Port frei ist. Meshtastic-App parallel: App auf USB, Morgendrot per Bluetooth (oder zweites Heltec).'

export const MESHTASTIC_BLE_LINK_LOST_MSG =
  'Bluetooth-Verbindung zum Heltec getrennt (GATT). Bitte erneut „Bluetooth verbinden“ — am PC oft stabiler: USB verbinden.'

export const MESHTASTIC_BLE_CONNECT_FAILED_MSG =
  'Bluetooth-Verbindung fehlgeschlagen. Heltec eingeschaltet? In Reichweite? Anderen Tab/App vom Gerät trennen, dann erneut verbinden — oder USB nutzen.'

export const MESHTASTIC_USB_LINK_LOST_MSG =
  'USB-Verbindung zum Heltec verloren (Web Serial). Sticky-Reconnect läuft — kurz warten oder erneut „USB verbinden“ / „Nochmals senden“.'

/** GATT/Web-BT Link tot oder Connect gescheitert (Chrome NetworkError). */
export function isMeshtasticBleLinkLostError(err: unknown): boolean {
  const name = err instanceof Error ? err.name : ''
  const msg = err instanceof Error ? err.message : String(err)
  if (name === 'NetworkError') return true
  if (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'NetworkError') {
    return true
  }
  return /GATT|gatt\.connect|BluetoothRemoteGATT|GATT Server is disconnected|Connection attempt failed|NetworkError/i.test(
    msg
  )
}

/**
 * Web Serial: Port tot, UI kann noch „verbunden“ zeigen (MeshDevice-Objekt lebt).
 * Chrome: „The device has been lost.“
 */
export function isWebSerialDeviceLostError(err: unknown): boolean {
  const name = err instanceof Error ? err.name : ''
  const msg = err instanceof Error ? err.message : String(err)
  /** Chrome/Web Serial: UART-Break → oft tot für die Session („Break received“ / BreakError). */
  if (name === 'BreakError' || /break\s+received/i.test(msg)) return true
  return /device has been lost|Failed to execute '(?:write|open|getInfo)' on 'SerialPort'|NetworkError.*serial|serial port.*(lost|disconnect)|readable stream.*(?:cancel|error|closed)/i.test(
    msg
  )
}

/** BLE- oder USB-Link tot — Session verwerfen + sticky Reconnect. */
export function isMeshtasticTransportLinkLostError(err: unknown): boolean {
  return isMeshtasticBleLinkLostError(err) || isWebSerialDeviceLostError(err)
}

export function formatMeshtasticBleTransportError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/Connection attempt failed/i.test(msg)) {
    return `${MESHTASTIC_BLE_CONNECT_FAILED_MSG}\n\n(${msg})`
  }
  if (isMeshtasticBleLinkLostError(err)) {
    return `${MESHTASTIC_BLE_LINK_LOST_MSG}\n\n(${msg})`
  }
  return msg
}

export function formatMeshtasticTransportLinkLostError(
  err: unknown,
  transportKind: 'bluetooth' | 'usb'
): string {
  if (transportKind === 'usb' && isWebSerialDeviceLostError(err)) {
    const msg = err instanceof Error ? err.message : String(err)
    return `${MESHTASTIC_USB_LINK_LOST_MSG}\n\n(${msg})`
  }
  return formatMeshtasticBleTransportError(err)
}

/**
 * Schließt alle vom Browser bereits freigegebenen SerialPorts (z. B. nach Tresor-Relogin
 * ohne sauberes Trennen — sonst „The port is already open“).
 */
export async function releaseGrantedWebSerialPorts(): Promise<number> {
  if (typeof navigator === 'undefined') return 0
  const serial = (
    navigator as Navigator & {
      serial?: {
        getPorts: () => Promise<
          Array<{ close: () => Promise<void>; readable?: unknown; writable?: unknown }>
        >
      }
    }
  ).serial
  if (!serial?.getPorts) return 0
  let closed = 0
  try {
    const ports = await serial.getPorts()
    for (const port of ports) {
      try {
        await port.close()
        closed += 1
      } catch {
        /* schon zu oder nicht offen */
      }
    }
  } catch {
    /* getPorts nicht verfügbar */
  }
  return closed
}

export function isWebSerialAlreadyOpenError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /already open|port is already open/i.test(msg)
}

export function augmentWebSerialConnectError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  const hints: string[] = []

  if (isWebSerialAlreadyOpenError(err)) {
    hints.push(
      'Port hängt noch vom vorherigen Login/Tab. „Trennen“ klicken oder Seite neu laden, dann erneut „USB verbinden“. Meshtastic-Web/CLI parallel schließen.'
    )
  } else if (isWebSerialDeviceLostError(err)) {
    hints.push(MESHTASTIC_USB_LINK_LOST_MSG)
  } else if (
    /failed to open|access denied|could not open|in use|busy|networkerror|notallowederror|device not found/i.test(
      msg
    ) ||
    (lower.includes('port') &&
      (lower.includes('open') || lower.includes('claim') || lower.includes('exclusive')))
  ) {
    hints.push(
      'USB-Port belegt oder nicht freigegeben — in der Meshtastic-App/Web/CLI „Disconnect“ bzw. Fenster schließen, dann hier erneut „USB verbinden“. Alternativ: Bluetooth verbinden und Config weiter per USB in der Meshtastic-App.'
    )
  }

  if (/cancel|aborted|user cancelled|the user cancelled/i.test(msg) || err instanceof DOMException && err.name === 'NotFoundError') {
    hints.push(
      'Kein Port gewählt. Picker erneut öffnen oder — wenn Meshtastic-App den Heltec hält — dort trennen bzw. Bluetooth in Morgendrot nutzen.'
    )
  }

  if (hints.length === 0) {
    hints.push(
      'Web Serial: ein Port = ein Programm. Config in Meshtastic-App, Chat hier — nicht beide gleichzeitig auf demselben USB.'
    )
  }

  return `${msg}\n\n${hints.join('\n\n')}`
}
