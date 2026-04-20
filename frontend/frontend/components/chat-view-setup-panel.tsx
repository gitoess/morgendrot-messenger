'use client'

/**
 * „Partner verbinden“: Handshake, Schnell verbinden, Mesh/BLE, Kontakt-Export/Import, lokaler Inbox-Purge.
 * Zustand und Handler für API-Aufrufe bleiben in der View; dieses Panel ist die Darstellung.
 */

import type { Dispatch, SetStateAction } from 'react'
import { AlertTriangle, QrCode, Radio, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  clearLocalHistory,
  exportContactMeshEncrypted,
  importContactMeshEncrypted,
  saveContactEntry,
  type ContactMeshEntryClient,
} from '@/frontend/lib/api'
import { parseMeshBundleFromQrText, scanMeshBundleQrWithCamera } from '@/frontend/lib/mesh-qr'
import type { Message } from '@/frontend/lib/types'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { ChatViewShadowSweep } from '@/frontend/components/chat-view-shadow-sweep'
import {
  MessengerGuideHint,
  MessengerHandbookChatLink,
  MESSENGER_HB_ANCHOR_HANDSHAKE,
  MESSENGER_HB_ANCHOR_HANDSHAKE_TRUST,
  MESSENGER_HB_ANCHOR_HELTEC_MESH,
  MESSENGER_HB_ANCHOR_PACKAGE_ID,
} from '@/components/messenger-handbook-link'

export type ChatViewSetupPanelMeshtastic = {
  bleSupported: boolean
  serialSupported: boolean
  transportKind: 'bluetooth' | 'usb'
  connected: boolean
  connecting: boolean
  error: string | null
  lastRxDebug?: string | null
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
  localPurgeBusy: boolean
  setLocalPurgeBusy: (v: boolean) => void
  setMessages: Dispatch<SetStateAction<Message[]>>
  /** Boss: dezenter Hinweis zu Handshake/Vertrauen */
  role?: string
  activePackageId?: string
  inboxPackageFilter: string
  onInboxPackageFilterChange: (v: string) => void
  packageIdSuggestions: string[]
  onRefreshPackageIdSuggestions: () => void
  onApplyPackageIdBackend: (raw: string) => void | Promise<void>
  onApplyInboxPackageFilterOnly: () => void | Promise<void>
  packageIdBusy?: boolean
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
    localPurgeBusy,
    setLocalPurgeBusy,
    setMessages,
    activePackageId,
    inboxPackageFilter,
    onInboxPackageFilterChange,
    packageIdSuggestions,
    onRefreshPackageIdSuggestions,
    onApplyPackageIdBackend,
    onApplyInboxPackageFilterOnly,
    packageIdBusy,
  } = p

  const pkgInput = inboxPackageFilter.trim() || activePackageId?.trim() || ''

  const showIotaPartner = encrypted || forcedTransport === 'internet'
  const showLora = forcedTransport === 'mesh'
  const showAdhoc = forcedTransport === 'adhoc'

  return (
    <div id="chat-partner-setup-panel" className="rounded-xl border border-border bg-card p-4 scroll-mt-4">
      <h3 className="text-lg font-semibold text-foreground">Verbindung & Postfach</h3>
      <p className="mt-1 mb-4 text-xs text-muted-foreground">
        Abschnitte folgen <strong className="text-foreground">Sendepfad</strong> und{' '}
        <strong className="text-foreground">Verschlüsselung</strong> — IOTA/Mailbox getrennt von LoRa und Ad-hoc.
      </p>

      {/* ——— IOTA · Postfach ——— */}
      <section className="mb-6 rounded-lg border border-border/80 bg-muted/10 p-3 sm:p-4" aria-labelledby="setup-iota-postfach">
        <h4 id="setup-iota-postfach" className="mb-2 text-sm font-semibold text-foreground">
          IOTA · Postfach · Package-ID (Mailbox / Deploy)
        </h4>
        <ChatViewShadowSweep />
        <div className="mt-3 rounded-lg border border-border bg-muted/15 px-3 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <MessengerGuideHint
              ariaLabel="Hilfe Package-ID und Posteingang"
              teaser="Mehr"
              anchor={MESSENGER_HB_ANCHOR_PACKAGE_ID}
            />
            <MessengerHandbookChatLink anchor={MESSENGER_HB_ANCHOR_PACKAGE_ID} className="ml-auto shrink-0" />
          </div>
          <p className="mb-2 font-mono text-[11px] text-muted-foreground">
            Backend aktiv:{' '}
            <span className="text-foreground">{activePackageId ? shortPackageId(activePackageId) : '—'}</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              list="morg-package-id-datalist"
              value={inboxPackageFilter}
              onChange={(e) => onInboxPackageFilterChange(e.target.value)}
              placeholder="0x… (64 Hex) einfügen"
              className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
            />
            <datalist id="morg-package-id-datalist">
              {packageIdSuggestions.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!packageIdBusy}
                onClick={() => void onApplyPackageIdBackend(pkgInput)}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {packageIdBusy ? '…' : 'Als aktiv speichern'}
              </button>
              <button
                type="button"
                onClick={() => void onApplyInboxPackageFilterOnly()}
                className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
                title="Mailbox für diese ID laden, ohne lokale Datei zu ändern"
              >
                Nur Postfach laden
              </button>
              <button
                type="button"
                onClick={() => void onRefreshPackageIdSuggestions()}
                className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
              >
                Liste aktualisieren
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-border/60 pt-4">
          <h5 className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Lokaler Postfach-Cache (dieses Gerät)
          </h5>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            Sichtbare Liste und optionaler Klartext-Cache auf dem Rechner — unabhängig von der Chain. Kontakte im
            Telefonbuch bleiben.
          </p>
          <button
            type="button"
            disabled={localPurgeBusy}
            onClick={async () => {
              if (
                !window.confirm(
                  'Lokalen Klartext-Inbox-Cache auf dem Server/Rechner schreddern und löschen? Die sichtbare Liste wird geleert. On-Chain-Daten bleiben.'
                )
              ) {
                return
              }
              setLocalPurgeBusy(true)
              setMeshSyncMsg(null)
              const r = await clearLocalHistory({ shred: true })
              setLocalPurgeBusy(false)
              if (r.ok) {
                setMessages([])
                setMeshSyncMsg('Lokaler Inbox-Cache geschreddert; Chat-Liste geleert. Kontakte unverändert.')
                toast.success('Lokaler Inbox-Cache geschreddert; Liste geleert.')
              } else {
                const err = r.error || 'Lokales Löschen fehlgeschlagen'
                setMeshSyncMsg(err)
                toast.error(err)
              }
            }}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-500/15 disabled:opacity-50 dark:text-red-300"
          >
            {localPurgeBusy ? 'Wird verwischt…' : 'Lokale Spuren verwischen (Inbox-Cache schreddern)'}
          </button>
        </div>
      </section>

      {/* ——— IOTA · Partner ——— */}
      {showIotaPartner ? (
        <section className="mb-6 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3 sm:p-4 dark:bg-amber-950/15" aria-labelledby="setup-iota-partner">
          <h4 id="setup-iota-partner" className="mb-2 text-sm font-semibold text-foreground">
            IOTA · Partner (0x) — Handshake & Mailbox
          </h4>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            Für <strong className="text-foreground">Online/IOTA</strong> brauchst du eine gültige{' '}
            <span className="font-mono">0x</span>-Adresse: oft <strong className="text-foreground">deine eigene</strong>{' '}
            (Notizen an dich), oder ein <strong className="text-foreground">Wallet nach Handshake</strong>. Für
            Klartext-IOTA sind auch andere Empfänger möglich — für <strong className="text-foreground">E2E</strong> immer
            Adresse prüfen.
          </p>
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2.5 dark:bg-amber-950/25">
            <div className="flex flex-wrap items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700/80 dark:text-amber-400/85" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1.5 text-xs leading-relaxed text-amber-950/90 dark:text-amber-50/90">
                <p>
                  <span className="font-medium text-amber-900 dark:text-amber-100">Handshake:</span> Partner-{' '}
                  <span className="font-mono">0x</span>-Adresse verifizieren. Falscher Partner = falsches Schlüsselmaterial.
                  Nach erfolgreichem Handshake kann der Partner im Rahmen der Mailbox mit dir kommunizieren — Tresor und
                  operative Daten separat absichern. Bei Auto-Ausführung am Node sind u. a.{' '}
                  <strong className="text-amber-950 dark:text-amber-50">Coin-Transfers</strong> und andere Befehle möglich
                  — siehe Handbuch.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <MessengerGuideHint
                    ariaLabel="Handshake Vertrauen und Risiken"
                    teaser="Risiken"
                    anchor={MESSENGER_HB_ANCHOR_HANDSHAKE_TRUST}
                  />
                  <MessengerHandbookChatLink anchor={MESSENGER_HB_ANCHOR_HANDSHAKE_TRUST} />
                </div>
              </div>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <MessengerGuideHint
              ariaLabel="Hilfe Handshake und Schnell verbinden"
              teaser="Handshake & /connect"
              anchor={MESSENGER_HB_ANCHOR_HANDSHAKE}
            />
            <MessengerHandbookChatLink anchor={MESSENGER_HB_ANCHOR_HANDSHAKE} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Partner-Adresse (0x)</label>
              <input
                type="text"
                value={partner}
                onChange={(e) => onPartnerChange(e.target.value)}
                placeholder="0x… (64 Hex)"
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={onHandshake}
                disabled={!partner.trim() || sending}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? 'Wird gestartet...' : 'Handshake starten'}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Schnell verbinden</label>
              <p className="text-sm text-muted-foreground">Nutzt die Standard-Partner-Adresse aus der Konfiguration (.env).</p>
              <button
                type="button"
                onClick={onConnect}
                disabled={sending}
                className="w-full rounded-lg border border-border bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? 'Verbinde...' : 'Schnell verbinden'}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-6 rounded-lg border border-dashed border-border px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">IOTA-Partner & Handshake</strong> sind nur für den Sendepfad{' '}
          <span className="font-mono">online</span> (oder bei E2E) relevant. Im{' '}
          <span className="font-mono">funk</span>-Klartext brauchst du im Composer <strong className="text-foreground">keine</strong>{' '}
          0x-Empfängeradresse (Broadcast) — optional Ziel-Knoten <span className="font-mono">!…</span> im Nachrichtenfeld.
        </section>
      )}

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
