import { describe, it, expect } from 'vitest'
import {
  MESHTASTIC_OWNERSHIP_HINT,
  MESHTASTIC_BLE_LINK_LOST_MSG,
  MESHTASTIC_USB_LINK_LOST_MSG,
  augmentWebSerialConnectError,
  formatMeshtasticBleTransportError,
  formatMeshtasticTransportLinkLostError,
  isMeshtasticBleLinkLostError,
  isMeshtasticTransportLinkLostError,
  isWebSerialAlreadyOpenError,
  isWebSerialDeviceLostError,
} from '@/frontend/lib/meshtastic-transport-ownership'

describe('meshtastic-transport-ownership', () => {
  it('Ownership-Hinweis nennt Config vs Chat', () => {
    expect(MESHTASTIC_OWNERSHIP_HINT).toMatch(/Meshtastic-App/)
    expect(MESHTASTIC_OWNERSHIP_HINT).toMatch(/Bluetooth/)
  })

  it('Port-belegt → klarer Hinweis', () => {
    const out = augmentWebSerialConnectError(new Error('Failed to open serial port'))
    expect(out).toMatch(/Port belegt|Meshtastic-App/i)
  })

  it('Abbruch → Picker-Hinweis', () => {
    const out = augmentWebSerialConnectError(new DOMException('No port selected', 'NotFoundError'))
    expect(out).toMatch(/Kein Port|Bluetooth/i)
  })

  it('erkennt GATT-Disconnect', () => {
    const err = new Error(
      "Failed to execute 'writeValue' on 'BluetoothRemoteGATTCharacteristic': GATT Server is disconnected."
    )
    expect(isMeshtasticBleLinkLostError(err)).toBe(true)
    expect(formatMeshtasticBleTransportError(err)).toContain(MESHTASTIC_BLE_LINK_LOST_MSG)
  })

  it('erkennt Connection attempt failed', () => {
    const err = new DOMException('Connection attempt failed.', 'NetworkError')
    expect(isMeshtasticBleLinkLostError(err)).toBe(true)
    expect(formatMeshtasticBleTransportError(err)).toMatch(/Bluetooth-Verbindung fehlgeschlagen/)
  })

  it('Port already open → Relogin-Hinweis', () => {
    const err = new Error("Failed to execute 'open' on 'SerialPort': The port is already open.")
    expect(isWebSerialAlreadyOpenError(err)).toBe(true)
    expect(augmentWebSerialConnectError(err)).toMatch(/vorherigen Login|Trennen/i)
  })

  it('erkennt Web-Serial „device has been lost“', () => {
    const err = new DOMException('The device has been lost.', 'NetworkError')
    expect(isWebSerialDeviceLostError(err)).toBe(true)
    expect(isMeshtasticTransportLinkLostError(err)).toBe(true)
    expect(formatMeshtasticTransportLinkLostError(err, 'usb')).toContain(MESHTASTIC_USB_LINK_LOST_MSG)
  })

  it('erkennt UART Break received als USB-Link-Verlust', () => {
    const err = new DOMException('Break received', 'BreakError')
    expect(isWebSerialDeviceLostError(err)).toBe(true)
    expect(isMeshtasticTransportLinkLostError(err)).toBe(true)
  })
})
