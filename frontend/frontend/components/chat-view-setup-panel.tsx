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
import { ChatViewShadowSweep } from '@/frontend/components/chat-view-shadow-sweep'

export type ChatViewSetupPanelMeshtastic = {
  bleSupported: boolean
  connected: boolean
  connecting: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

export type ChatViewSetupPanelProps = {
  partner: string
  onPartnerChange: (v: string) => void
  sending: boolean
  onHandshake: () => void
  onConnect: () => void
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
    role,
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

  return (
    <div id="chat-partner-setup-panel" className="rounded-xl border border-border bg-card p-4 scroll-mt-4">
      <h3 className="mb-4 font-semibold text-foreground">Partner verbinden · IOTA-Handshake & Funk (LoRa/Web-Bluetooth)</h3>
      {role === 'boss' && (
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2.5 dark:bg-amber-950/25">
          <div className="flex gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700/80 dark:text-amber-400/85" aria-hidden />
            <p className="text-xs leading-relaxed text-amber-950/90 dark:text-amber-50/90">
              <span className="font-medium text-amber-900 dark:text-amber-100">Handshake:</span> Vor{' '}
              <span className="font-medium">Handshake starten</span> Partner-Adresse prüfen. Nach erfolgreichem Handshake kann
              der Partner im Rahmen der Mailbox mit dir kommunizieren – Tresor und operative Daten separat absichern.
            </p>
          </div>
        </div>
      )}
      <ChatViewShadowSweep />
      <div className="mb-4 rounded-lg border border-border bg-muted/15 px-3 py-3">
        <p className="mb-2 text-xs font-semibold text-foreground">Package-ID (Mailbox / Deploy)</p>
        <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
          Wenn du eine ID per Messenger, Datei oder mündlich erhältst: hier eintragen.{' '}
          <span className="font-medium text-foreground">Aktiv speichern</span> schreibt sie wie{' '}
          <span className="font-mono">/set-package-id</span>.{' '}
          <span className="font-medium text-foreground">Nur Posteingang</span> lädt die Mailbox für diese ID ohne die lokale
          Datei zu ändern.
        </p>
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
            >
              Nur Posteingang
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
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Kein separater „Handshake annehmen“-Knopf:</strong>{' '}
        <span className="font-medium text-foreground">Schnell verbinden</span> führt intern{' '}
        <span className="font-mono text-[11px]">/connect</span> aus: Die Kette/Mailbox wird abgefragt. Kommt der
        Handshake deines Partners zuerst, antwortet das Backend automatisch mit deinem Handshake; sonst wird einmal
        dein Handshake gesendet und auf die Gegenpartei gewartet. Typischer Ablauf: A trägt B ein und startet
        Handshake; B führt <span className="font-medium">Schnell verbinden</span> aus (nutzt{' '}
        <span className="font-mono">PARTNER_ADDRESS</span> / Kommandant aus <span className="font-mono">.env</span>
        ) oder im Terminal <span className="font-mono">/connect 0x…</span> mit der Adresse von A. Ist links eine
        gültige <span className="font-mono">0x</span>+64-Hex eingetragen, verwendet Schnell verbinden genau diese
        Adresse (hilfreich z. B. beim Test mit dir selbst). <span className="font-medium text-foreground">Wichtig:</span>{' '}
        Nach dem Klick dauert die echte Verbindung oft noch Sekunden — erst wenn der Status „verbunden“ zeigt, klappt
        verschlüsselt inkl. Mesh v2.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">Neuen Partner hinzufügen</label>
          <input
            type="text"
            value={partner}
            onChange={(e) => onPartnerChange(e.target.value)}
            placeholder="Partner-Adresse (0x...)"
            className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          <label className="block text-sm font-medium text-foreground">Mit Standard-Adresse verbinden</label>
          <p className="text-sm text-muted-foreground">Verwendet die Adresse aus deiner .env-Datei</p>
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

      <div className="mt-6 border-t border-border pt-4">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Radio className="h-4 w-4" />
          Mesh / Funk (experimentell)
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
        <p className="mb-3 text-xs text-muted-foreground">
          Verbindung: <strong className="text-foreground">Heltec (Web Bluetooth) verbinden</strong> nutzt die
          Meshtastic-Bibliothek (<span className="font-mono">TransportWebBluetooth</span>) — der Browser zeigt die
          System-<strong className="text-foreground">Bluetooth-Geräteliste</strong> (kein eigener „Gerät suchen“-Dialog in
          Morgendrot). <strong className="text-foreground">USB am PC</strong> lädt ggf. nur Strom/Firmware-Serial; der
          Messenger-Pfad hier geht per <strong className="text-foreground">BLE</strong> vom Rechner zum Heltec (PC-Bluetooth
          an, Heltec sendet im Mesh-Kanal). <strong className="text-foreground">Brave</strong> hat Web Bluetooth oft
          standardmäßig aus — <span className="font-mono">brave://flags</span> aktivieren oder <strong className="text-foreground">Chrome/Edge</strong>{' '}
          nutzen; sicheren Kontext beachten. Eingehende Texte und{' '}
          <span className="font-mono">PRIVATE_APP</span> Binary v2 erscheinen im Posteingang (Zuordnung über
          Adress-Fingerprint). Export/Import: Mesh-Metadaten inkl. <span className="font-mono">bleUuid</span>-Reserve.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {!meshtastic.bleSupported ? (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Web Bluetooth nicht verfügbar (Browser/OS).
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
            </>
          ) : (
            <button
              type="button"
              disabled={meshtastic.connecting}
              onClick={() => void meshtastic.connect()}
              className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {meshtastic.connecting ? 'Verbinde…' : 'Heltec (Web Bluetooth) verbinden'}
            </button>
          )}
        </div>
        {meshtastic.error && (
          <p className="mb-2 whitespace-pre-wrap break-words text-xs text-red-500 dark:text-red-400">{meshtastic.error}</p>
        )}

        <div className="mb-4 rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Adressbuch: Partner-0x + optionale BLE-Geräte-UUID</p>
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">0x… (64 Hex):</strong> deine bzw. Partner-<strong className="text-foreground">IOTA-/Mailbox-Kryptoadresse</strong> — dient
            Entschlüsselung, Kontext und späterem <strong className="text-foreground">Online-/IOTA</strong>-Weg; das ist{' '}
            <strong className="text-foreground">nicht</strong> die Meshtastic-Luftadresse.{' '}
            <strong className="text-foreground">Meshtastic-Knoten</strong> (!… Hex) kommt aus dem Funkpaket; im Chat siehst du ggf.{' '}
            <span className="font-mono">mesh:!…</span> bis der Absender per Fingerprint dieser 0x zugeordnet ist.{' '}
            <strong className="text-foreground">BLE-Geräte-UUID:</strong> reserviert für <strong className="text-foreground">geplanten</strong> Smartphone-zu-Smartphone-BLE
            (ohne Heltec) — <strong className="text-foreground">kein</strong> Web-Bluetooth zum Heltec; Export/Import über Mesh-Bundle. Format UUID mit/ohne Bindestriche.
          </p>
          <input
            type="text"
            value={contactBleAddress}
            onChange={(e) => onContactBleAddressChange(e.target.value.trim())}
            placeholder="Partner 0x… (64 Hex)"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
          />
          <input
            type="text"
            value={contactBleUuid}
            onChange={(e) => onContactBleUuidChange(e.target.value.trim())}
            placeholder="BLE-Geräte-UUID"
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
                bleUuid: contactBleUuid.trim() || undefined,
                meshNodeId: contactMeshNodeId.trim() || undefined,
              })
              setContactBleBusy(false)
              if (r.ok) {
                setMeshSyncMsg(r.message || 'Kontakt mit BLE-ID gespeichert.')
                refreshContactDirectory()
              } else {
                setMeshSyncMsg(r.error || 'Speichern fehlgeschlagen')
              }
            }}
            className="w-full rounded-lg border border-border py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {contactBleBusy ? 'Speichere…' : 'Kontakt speichern (0x + optional BLE / Node-ID)'}
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
        {meshSyncMsg && <p className="mt-2 text-xs text-muted-foreground">{meshSyncMsg}</p>}

        <div className="mt-6 border-t border-border pt-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Trash2 className="h-4 w-4" />
            Lokaler Verlauf und Datenschutz
          </h4>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Ist-Zustand dieser Web-UI:</strong> Die Liste unten liegt nur im{' '}
            <span className="font-mono">RAM</span> (React-State). Es gibt hier <strong>keine</strong> IndexedDB- oder
            SQLite-Persistenz für den Chat. Auf dem Rechner (neben dem Vault) kann zusätzlich die verschlüsselte Datei{' '}
            <span className="font-mono">.morgendrot-vault.inbox.enc</span> existieren – darin speichert das Backend
            entschlüsselte Snippets nach <span className="font-mono">/fetch</span> (wenn aktiv). Shred überschreibt
            diese Datei vor dem Löschen (best effort; SSDs können Reste behalten).
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
      </div>
    </div>
  )
}
