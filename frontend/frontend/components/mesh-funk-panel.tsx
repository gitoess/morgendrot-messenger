'use client'

import { Radio } from 'lucide-react'

/** BLE-/Mesh-UI-Zustand (von useMeshtasticBle oder Stub). */
export type MeshFunkBleController = {
  bleSupported: boolean
  serialSupported: boolean
  transportKind: 'bluetooth' | 'usb'
  connected: boolean
  connecting: boolean
  error: string | null
  connect: () => Promise<void>
  connectBluetooth: () => Promise<void>
  connectUsb: () => Promise<void>
  disconnect: () => void
}

type MeshFunkPanelProps = {
  ble: MeshFunkBleController
  previewLines: string[]
  contextHint?: string
}

export function MeshFunkPanel({ ble: meshtastic, previewLines, contextHint }: MeshFunkPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Radio className="h-4 w-4" />
        Mesh / Funk (experimentell)
      </h4>
      <p className="mb-2 text-xs text-muted-foreground">
        Heltec per Web Bluetooth (Chrome/Edge; Brave oft aus — <span className="font-mono">brave://flags</span>, localhost). Pro Browser-Tab meist nur eine aktive BT-Verbindung zum
        gleichen Gerät – wenn du parallel <strong className="text-foreground">Nachrichten</strong> offen hast, dort oder
        hier koppeln, nicht doppelt.
      </p>
      {contextHint ? (
        <p className="mb-3 text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">{contextHint}</p>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          Eingehende Texte und PRIVATE_APP Binary v2 (Zuordnung über Kontaktverzeichnis / Fingerprint).
        </p>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        {!meshtastic.bleSupported && !meshtastic.serialSupported ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Web Bluetooth/Serial nicht verfügbar (Browser/OS).
          </span>
        ) : meshtastic.connected ? (
          <>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Meshtastic verbunden</span>
            <span className="text-[11px] text-muted-foreground">
              {meshtastic.transportKind === 'usb' ? 'USB (Web Serial)' : 'Bluetooth (Web BT)'}
            </span>
            <button
              type="button"
              onClick={() => meshtastic.disconnect()}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Trennen
            </button>
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
          </>
        )}
      </div>
      {meshtastic.error && <p className="mb-2 text-xs text-red-500 dark:text-red-400">{meshtastic.error}</p>}
      {previewLines.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-muted/20 p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Zuletzt per Funk empfangen (Vorschau)
          </p>
          <ul className="max-h-36 space-y-1 overflow-y-auto text-[11px] font-mono text-muted-foreground">
            {previewLines.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
