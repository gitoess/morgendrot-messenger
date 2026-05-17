'use client'

/**
 * „Kontakt & Verbindung“: Partner-Wallet (0x), optional Handshake, Mesh/BLE, Package-ID (Admin), lokaler Inbox-Purge.
 * Zustand und Handler für API-Aufrufe bleiben in der View; dieses Panel ist die Darstellung.
 */

import { useMemo } from 'react'
import { QrCode, Radio } from 'lucide-react'
import { toast } from 'sonner'
import {
  exportContactMeshEncrypted,
  importContactMeshEncrypted,
  saveContactEntry,
  type ContactMeshEntryClient,
} from '@/frontend/lib/api'
import { parseMeshBundleFromQrText, scanMeshBundleQrWithCamera } from '@/frontend/lib/mesh-qr'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import {
  MessengerGuideHint,
  MessengerHandbookChatLink,
  MESSENGER_HB_ANCHOR_HELTEC_MESH,
} from '@/components/messenger-handbook-link'

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
  partner: string
  onPartnerChange: (v: string) => void
  sending: boolean
  onHandshake: () => void
  onConnect: () => void
  encrypted: boolean
  forcedTransport: ForcedTransport
  meshtastic: ChatViewSetupPanelMeshtastic
  directory: Record<string, ContactMeshEntryClient>
  refreshContactDirectory: () => void
  contactBleAddress: string
  onContactBleAddressChange: (v: string) => void
  contactBleUuid: string
  onContactBleUuidChange: (v: string) => void
  contactMeshNodeId: string
  onContactMeshNodeIdChange: (v: string) => void
  contactBleBusy: boolean
  setContactBleBusy: (v: boolean) => void
  meshExportPw: string
  onMeshExportPwChange: (v: string) => void
  meshImportPw: string
  onMeshImportPwChange: (v: string) => void
  meshImportJson: string
  onMeshImportJsonChange: (v: string) => void
  meshSyncBusy: boolean
  setMeshSyncBusy: (v: boolean) => void
  meshSyncMsg: string | null
  setMeshSyncMsg: (v: string | null) => void
  /** Boss: dezenter Hinweis zu Handshake/Vertrauen */
  role?: string
  activePackageId?: string
  /** Aus GET /api/status — nur Anzeige, nicht editierbar. */
  serverMailboxIdMasked?: string
  mailboxConfigured?: boolean
  inboxPackageFilter: string
  onInboxPackageFilterChange: (v: string) => void
  packageIdSuggestions: string[]
  onRefreshPackageIdSuggestions: () => void
  onApplyPackageIdBackend: (raw: string) => void | Promise<void>
  onApplyInboxPackageFilterOnly: () => void | Promise<void>
  packageIdBusy?: boolean
  /** Gruppe: Handshake pro Mitglied (aktive Gruppe). */
  isGroupMode?: boolean
  groupMemberAddresses?: string[]
  connectedAddresses?: string[]
  onHandshakeForAddress?: (address: string) => void | Promise<void>
}

function shortPackageId(a: string) {
  const t = a.trim()
  if (t.length < 22) return t || '—'
  return `${t.slice(0, 12)}…${t.slice(-8)}`
}

export function ChatViewSetupPanel(p: ChatViewSetupPanelProps) {
  const {
    partner,
    onPartnerChange,
    sending,
    onHandshake,
    onConnect,
    encrypted,
    forcedTransport,
    meshtastic,
    directory,
    refreshContactDirectory,
    contactBleAddress,
    onContactBleAddressChange,
    contactBleUuid,
    onContactBleUuidChange,
    contactMeshNodeId,
    onContactMeshNodeIdChange,
    contactBleBusy,
    setContactBleBusy,
    meshExportPw,
    onMeshExportPwChange,
    meshImportPw,
    onMeshImportPwChange,
    meshImportJson,
    onMeshImportJsonChange,
    meshSyncBusy,
    setMeshSyncBusy,
    meshSyncMsg,
    setMeshSyncMsg,
    activePackageId,
    serverMailboxIdMasked,
    mailboxConfigured,
    inboxPackageFilter,
    onInboxPackageFilterChange,
    packageIdSuggestions,
    onRefreshPackageIdSuggestions,
    onApplyPackageIdBackend,
    onApplyInboxPackageFilterOnly,
    packageIdBusy,
    isGroupMode = false,
    groupMemberAddresses = [],
    connectedAddresses = [],
    onHandshakeForAddress,
  } = p

  const pkgInput = inboxPackageFilter.trim() || activePackageId?.trim() || ''
  const connectedSet = useMemo(
    () => new Set(connectedAddresses.map((a) => a.trim().toLowerCase()).filter(Boolean)),
    [connectedAddresses]
  )
  const groupMembers = useMemo(
    () =>
      groupMemberAddresses
        .map((a) => a.trim().toLowerCase())
        .filter((a) => /^0x[a-f0-9]{64}$/.test(a)),
    [groupMemberAddresses]
  )

  const showLora = forcedTransport === 'mesh'
  const showAdhoc = forcedTransport === 'adhoc'

  return (
    <div id="chat-partner-setup-panel" className="rounded-xl border border-border bg-card p-4 scroll-mt-4">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        {showLora || showAdhoc ? 'Funk & Geräte' : 'Kontakt & Verbindung'}
      </h3>

      {/* ——— LoRa · Heltec ——— */}
      {showLora ? (
      <div className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/[0.04] p-3 sm:p-4 dark:bg-sky-950/10">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Radio className="h-4 w-4" />
          LoRa · Heltec & Meshtastic
        </h4>
        {typeof window !== 'undefined' && !window.isSecureContext ? (
          <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-950 dark:text-amber-50/90">
            <strong className="text-foreground">Web Bluetooth:</strong> Chromium-Browser erlauben die API nur in einem{' '}
            <strong className="text-foreground">sicheren Kontext</strong> (HTTPS oder{' '}
            <span className="font-mono">http://127.0.0.1</span> / <span className="font-mono">localhost</span>). Unter{' '}
            <span className="font-mono">http://192.168.…</span> o. Ä. erscheint oft{' '}
            <span className="font-mono">Web Bluetooth API globally disabled</span> — Abhilfe:{' '}
            <strong className="text-foreground">adb reverse tcp:3341</strong> und am Telefon{' '}
            <span className="font-mono">http://127.0.0.1:3341</span>, oder TLS-Dev-URL / Deploy mit HTTPS.
          </p>
        ) : null}
        <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">Heltec</strong> per Web Bluetooth — Details im Handbuch.
          </span>
          <MessengerGuideHint
            ariaLabel="Hilfe Heltec, Web Bluetooth, Posteingang"
            teaser="Mehr"
            anchor={MESSENGER_HB_ANCHOR_HELTEC_MESH}
          />
          <MessengerHandbookChatLink anchor={MESSENGER_HB_ANCHOR_HELTEC_MESH} />
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {!meshtastic.bleSupported && !meshtastic.serialSupported ? (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Web Bluetooth/Serial nicht verfügbar (Browser/OS).
            </span>
          ) : meshtastic.connected ? (
            <>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">Meshtastic verbunden</span>
              <span className="text-[11px] text-muted-foreground">
                Transport: {meshtastic.transportKind === 'usb' ? 'USB (Web Serial)' : 'Bluetooth (Web BT)'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                RX: {meshtastic.lastRxDebug ?? 'noch kein Paket gesehen'}
              </span>
              {meshtastic.meshRxSubscriptions ? (
                <span className="w-full text-[10px] leading-snug text-muted-foreground" title="Gebundene MeshDevice-Events">
                  Events: {meshtastic.meshRxSubscriptions}
                </span>
              ) : null}
              <span className="w-full text-[10px] leading-snug text-muted-foreground">
                F12-Konsole:{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[9px]">
                  localStorage.setItem(&quot;morgendrot.meshRxDebug&quot;,&quot;1&quot;)
                </code>{' '}
                → Seite neu laden; dann erscheinen{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[9px]">[morgendrot mesh]</code>-Zeilen bei RX.
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
        {meshtastic.error && (
          <p className="mb-2 whitespace-pre-wrap break-words text-xs text-red-500 dark:text-red-400">{meshtastic.error}</p>
        )}

        <div className="mb-4 rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Kontext für Funk (optional)</p>
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">0x… (64 Hex):</strong> Zuordnung eines Mesh-Absenders zu einer{' '}
            <strong className="text-foreground">IOTA-/Mailbox-Adresse</strong> (Fingerprint) —{' '}
            <strong className="text-foreground">nicht</strong> die LoRa-Zieladresse im Composer. Zum Senden auf Funk brauchst du{' '}
            <strong className="text-foreground">keine</strong> 0x im Nachrichtenfeld (Broadcast).{' '}
            <strong className="text-foreground">Node-ID</strong> <span className="font-mono">!…</span> wie am Radio — für Kontaktbuch und Zielwahl im Klartext-Composer.
          </p>
          <input
            type="text"
            value={contactBleAddress}
            onChange={(e) => onContactBleAddressChange(e.target.value.trim())}
            placeholder="0x… (64 Hex) — Zuordnung Mesh ↔ IOTA"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
          />
          <label className="text-[11px] font-medium text-foreground">Meshtastic Node-ID (optional)</label>
          <p className="text-[10px] text-muted-foreground">
            Funk-ID wie am Gerät/Radio: <span className="font-mono">!1a2b3c4d</span> — für Zuordnung und spätere
            Klartext-Ziele; unabhängig von der 0x-Mailbox-Adresse.
          </p>
          <input
            type="text"
            value={contactMeshNodeId}
            onChange={(e) => onContactMeshNodeIdChange(e.target.value.trim())}
            placeholder="!… (Meshtastic)"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
            spellCheck={false}
          />
          <button
            type="button"
            disabled={contactBleBusy || contactBleAddress.length < 66}
            onClick={async () => {
              setContactBleBusy(true)
              setMeshSyncMsg(null)
              const r = await saveContactEntry({
                address: contactBleAddress.trim(),
                meshNodeId: contactMeshNodeId.trim() || undefined,
              })
              setContactBleBusy(false)
              if (r.ok) {
                setMeshSyncMsg(r.message || 'Funk-Kontext gespeichert (0x + optional Node-ID).')
                refreshContactDirectory()
              } else {
                setMeshSyncMsg(r.error || 'Speichern fehlgeschlagen')
              }
            }}
            className="w-full rounded-lg border border-border py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {contactBleBusy ? 'Speichere…' : 'Funk-Kontext speichern (0x + optional Node-ID)'}
          </button>
          {Object.keys(directory).length > 0 && (
            <ul className="mt-2 max-h-28 overflow-y-auto text-[10px] font-mono text-muted-foreground space-y-0.5">
              {Object.entries(directory).map(([addr, e]) =>
                e.bleUuid || e.meshNodeId ? (
                  <li key={addr}>
                    {addr.slice(0, 10)}…
                    {e.meshNodeId ? (
                      <>
                        {' '}
                        · Node <span className="text-foreground">{e.meshNodeId}</span>
                      </>
                    ) : null}
                    {e.bleUuid ? (
                      <>
                        {' '}
                        · BLE <span className="text-foreground">{e.bleUuid}</span>
                      </>
                    ) : null}
                  </li>
                ) : null
              )}
            </ul>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Export (PC → QR / Datei)</p>
            <input
              type="password"
              autoComplete="new-password"
              value={meshExportPw}
              onChange={(e) => onMeshExportPwChange(e.target.value)}
              placeholder="Passwort (min. 8 Zeichen)"
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={meshSyncBusy || meshExportPw.length < 8}
              onClick={async () => {
                setMeshSyncBusy(true)
                setMeshSyncMsg(null)
                const r = await exportContactMeshEncrypted(meshExportPw)
                setMeshSyncBusy(false)
                if (r.ok && r.bundle) {
                  onMeshImportJsonChange(JSON.stringify(r.bundle))
                  setMeshSyncMsg('Bundle unten im Import-Feld – als QR encodieren oder kopieren.')
                  toast.success('Mesh-Daten exportiert – Bundle steht im Import-Feld.')
                } else {
                  const err = r.error || 'Export fehlgeschlagen'
                  setMeshSyncMsg(err)
                  toast.error(err)
                }
              }}
              className="w-full rounded-lg border border-border py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              Mesh-Daten exportieren
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Import</p>
            <input
              type="password"
              autoComplete="new-password"
              value={meshImportPw}
              onChange={(e) => onMeshImportPwChange(e.target.value)}
              placeholder="Passwort"
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={meshSyncBusy}
              onClick={async () => {
                setMeshSyncBusy(true)
                setMeshSyncMsg(null)
                const s = await scanMeshBundleQrWithCamera()
                if ('error' in s) {
                  setMeshSyncMsg(s.error)
                  toast.error(s.error)
                  setMeshSyncBusy(false)
                  return
                }
                onMeshImportJsonChange(s.bundleJson)
                setMeshSyncMsg('QR gelesen – Passwort prüfen und „Import anwenden“.')
                toast.success('QR gelesen – Import mit Passwort abschließen.')
                setMeshSyncBusy(false)
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              <QrCode className="h-3.5 w-3.5" />
              QR scannen (Capacitor)
            </button>
            <textarea
              value={meshImportJson}
              onChange={(e) => onMeshImportJsonChange(e.target.value)}
              placeholder="JSON-Bundle einfügen …"
              rows={4}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-[11px]"
            />
            <button
              type="button"
              disabled={meshSyncBusy || meshImportPw.length < 8 || !meshImportJson.trim()}
              onClick={async () => {
                const bundle = parseMeshBundleFromQrText(meshImportJson)
                if (!bundle) {
                  const err = 'Ungültiges Bundle-JSON'
                  setMeshSyncMsg(err)
                  toast.error(err)
                  return
                }
                setMeshSyncBusy(true)
                setMeshSyncMsg(null)
                const r = await importContactMeshEncrypted(meshImportPw, bundle)
                setMeshSyncBusy(false)
                if (r.ok) {
                  const msg = r.message || `Import OK (${r.merged ?? 0})`
                  setMeshSyncMsg(msg)
                  toast.success(msg)
                  refreshContactDirectory()
                } else {
                  const err = r.error || 'Import fehlgeschlagen'
                  setMeshSyncMsg(err)
                  toast.error(err)
                }
              }}
              className="w-full rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Import anwenden
            </button>
          </div>
        </div>
        {meshSyncMsg && showLora ? <p className="mt-2 text-xs text-muted-foreground">{meshSyncMsg}</p> : null}
      </div>
      ) : null}

      {showAdhoc ? (
        <section className="mb-2 rounded-lg border border-amber-500/35 bg-amber-500/[0.06] p-3 sm:p-4 dark:bg-amber-950/15" aria-labelledby="setup-adhoc-ble">
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
