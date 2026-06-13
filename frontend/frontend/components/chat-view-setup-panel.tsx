'use client'

/**
 * Funk & Geräte: Meshtastic (LoRa/Heltec) und Ad-hoc-BLE-Kontakt.
 * Partner/Handshake/Package-ID liegen in `ChatViewEncryptedPartnerPanel` bzw. Transport-Karte.
 */

import { saveContactEntry } from '@/frontend/lib/api'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { MESHTASTIC_WEB_DEVICE_SETTINGS_URL } from '@/frontend/lib/chat-view-messenger-transport'

export type ChatViewSetupPanelMeshtastic = {
  bleSupported: boolean
  serialSupported: boolean
  transportKind: 'bluetooth' | 'usb'
  connected: boolean
  connecting: boolean
  error: string | null
  lastRxDebug?: string | null
  /** z. B. `onMessagePacket, onMeshPacket` — wenn leer/fehlend, Events nicht am Transport. */
  meshRxSubscriptions?: string | null
  connect: () => Promise<void>
  connectBluetooth: () => Promise<void>
  connectUsb: () => Promise<void>
  disconnect: () => void
}

export type ChatViewSetupPanelProps = {
  forcedTransport: ForcedTransport
  meshtastic: ChatViewSetupPanelMeshtastic
  refreshContactDirectory: () => void
  contactBleAddress: string
  onContactBleAddressChange: (v: string) => void
  contactBleUuid: string
  onContactBleUuidChange: (v: string) => void
  contactBleBusy: boolean
  setContactBleBusy: (v: boolean) => void
  meshSyncMsg: string | null
  setMeshSyncMsg: (v: string | null) => void
}

export function ChatViewSetupPanel(p: ChatViewSetupPanelProps) {
  const {
    forcedTransport,
    meshtastic,
    refreshContactDirectory,
    contactBleAddress,
    onContactBleAddressChange,
    contactBleUuid,
    onContactBleUuidChange,
    contactBleBusy,
    setContactBleBusy,
    meshSyncMsg,
    setMeshSyncMsg,
  } = p

  const showLora = forcedTransport === 'mesh'
  const showAdhoc = forcedTransport === 'adhoc'
  if (!showLora && !showAdhoc) return null

  return (
    <div id="chat-partner-setup-panel" className="rounded-xl border border-border bg-card p-4 scroll-mt-4">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Funk & Geräte</h3>

      {showLora ? (
        <div className="flex flex-wrap items-center gap-2">
          {!meshtastic.bleSupported && !meshtastic.serialSupported ? (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Web Bluetooth/Serial nicht verfügbar (Browser/OS).
            </span>
          ) : meshtastic.connected ? (
            <>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">Meshtastic verbunden</span>
              <button
                type="button"
                onClick={() => meshtastic.disconnect()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Trennen
              </button>
              <a
                href={MESHTASTIC_WEB_DEVICE_SETTINGS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                Meshtastic einrichten
              </a>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={meshtastic.connecting || !meshtastic.bleSupported}
                onClick={() => void meshtastic.connectBluetooth()}
                className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                {meshtastic.connecting && meshtastic.transportKind === 'bluetooth'
                  ? 'Verbinde…'
                  : 'Bluetooth verbinden'}
              </button>
              <button
                type="button"
                disabled={meshtastic.connecting || !meshtastic.serialSupported}
                onClick={() => void meshtastic.connectUsb()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                {meshtastic.connecting && meshtastic.transportKind === 'usb'
                  ? 'USB verbindet…'
                  : 'USB verbinden'}
              </button>
              <a
                href={MESHTASTIC_WEB_DEVICE_SETTINGS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                Meshtastic einrichten
              </a>
            </>
          )}
          {meshtastic.error ? (
            <p className="w-full whitespace-pre-wrap break-words text-xs text-red-500 dark:text-red-400">
              {meshtastic.error}
            </p>
          ) : null}
        </div>
      ) : null}

      {showAdhoc ? (
        <section
          className="mb-2 rounded-lg border border-amber-500/35 bg-amber-500/[0.06] p-3 sm:p-4 dark:bg-amber-950/15"
          aria-labelledby="setup-adhoc-ble"
        >
          <h4 id="setup-adhoc-ble" className="mb-2 text-sm font-semibold text-foreground">
            Ad-hoc · BLE-Gerät (geplant)
          </h4>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            Vorbereitung für Smartphone-zu-Smartphone-BLE <strong className="text-foreground">ohne</strong> Heltec/Web-BT.
            <strong className="text-foreground"> BLE-Geräte-UUID</strong> gehört hierher — nicht zum LoRa-Heltec-Pfad.
          </p>
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            <label className="text-xs font-medium text-foreground">Optionale IOTA-/Label-Adresse (0x)</label>
            <input
              type="text"
              value={contactBleAddress}
              onChange={(e) => onContactBleAddressChange(e.target.value.trim())}
              placeholder="0x… (64 Hex) — Kontext / späteres Routing"
              className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
            />
            <label className="text-xs font-medium text-foreground">BLE-Geräte-UUID</label>
            <input
              type="text"
              value={contactBleUuid}
              onChange={(e) => onContactBleUuidChange(e.target.value.trim())}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
            />
            <button
              type="button"
              disabled={
                contactBleBusy ||
                contactBleAddress.trim().length < 66 ||
                contactBleUuid.replace(/-/g, '').trim().length < 8
              }
              onClick={async () => {
                setContactBleBusy(true)
                setMeshSyncMsg(null)
                const addr = contactBleAddress.trim()
                const uuid = contactBleUuid.trim()
                if (addr.length < 66) {
                  setMeshSyncMsg('Gültige 0x-Adresse (64 Hex) eintragen.')
                  setContactBleBusy(false)
                  return
                }
                if (uuid.length < 8) {
                  setMeshSyncMsg('BLE-Geräte-UUID eintragen.')
                  setContactBleBusy(false)
                  return
                }
                const r = await saveContactEntry({
                  address: addr,
                  bleUuid: uuid || undefined,
                })
                setContactBleBusy(false)
                if (r.ok) {
                  setMeshSyncMsg(r.message || 'Ad-hoc/BLE-Kontakt gespeichert.')
                  refreshContactDirectory()
                } else {
                  setMeshSyncMsg(r.error || 'Speichern fehlgeschlagen')
                }
              }}
              className="w-full rounded-lg border border-border py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {contactBleBusy ? 'Speichere…' : 'Ad-hoc-Kontakt speichern (0x + BLE-UUID)'}
            </button>
          </div>
        </section>
      ) : null}

      {meshSyncMsg && !showLora ? <p className="mt-2 text-xs text-muted-foreground">{meshSyncMsg}</p> : null}
    </div>
  )
}
