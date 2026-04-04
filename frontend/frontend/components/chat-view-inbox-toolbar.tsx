'use client'

/**
 * Posteingang: Kopfzeile (Zähler, Boss-Ansicht, .morg-pkg, Aktualisieren).
 * Reine Präsentation; kein Mesh-Routing. Meshtastic-First: Funk bleibt im Meshtastic-Stack/Firmware –
 * diese Leiste bedient IOTA-Mailbox-Refresh und Sneakernet/morg-pkg, ohne parallele „Funkprotokolle“ in der UI.
 */

import type { ChangeEvent, RefObject } from 'react'
import { Archive, FileDown, Inbox, KeyRound, Lock, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import type { Message } from '@/frontend/lib/types'
import { ChatViewProtokollAnchorButton } from '@/frontend/components/chat-view-protokoll-anchor-button'

export type ChatViewInboxToolbarProps = {
  messageCount: number
  inboxRowCount: number
  role: string
  bossView: boolean
  onBossViewChange: (checked: boolean) => void
  morgPkgFileRef: RefObject<HTMLInputElement | null>
  morgPkgDeviceFilesRef: RefObject<HTMLInputElement | null>
  onMorgPkgImportFile: (e: ChangeEvent<HTMLInputElement>) => void
  onMorgPkgDeviceFiles: (e: ChangeEvent<HTMLInputElement>) => void
  morgPkgDeviceBusy: boolean
  apiStatus: ApiStatus | null
  onRefresh: () => void
  loading: boolean
  onExportEinsatzberichtJson: () => void
  onExportEinsatzberichtTxt: () => void
  onExportEinsatzberichtEncrypted: () => void | Promise<void>
  onExportEinsatzprotokoll: () => void | Promise<void>
  onExportEinsatzprotokollPlainZip: () => void | Promise<void>
  onExportEinsatzprotokollMarked: () => void | Promise<void>
  protokollMarkedCount: number
  messages: Message[]
  myAddress: string
  recipient: string
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  inboxSelectMode: boolean
  setInboxSelectMode: (v: boolean | ((p: boolean) => boolean)) => void
  selectedInboxCount: number
  onSelectAllVisible: () => void
  onClearInboxSelection: () => void
  onBulkHideSelected: () => void
  onBulkPurgeSelected: () => void
  onHideAllVisibleLocal: () => void
}

export function ChatViewInboxToolbar(p: ChatViewInboxToolbarProps) {
  const {
    messageCount,
    inboxRowCount,
    role,
    bossView,
    onBossViewChange,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    onMorgPkgImportFile,
    onMorgPkgDeviceFiles,
    morgPkgDeviceBusy,
    apiStatus,
    onRefresh,
    loading,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    protokollMarkedCount,
    messages,
    myAddress,
    recipient,
    setStatus,
    setStatusMsg,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxCount,
    onSelectAllVisible,
    onClearInboxSelection,
    onBulkHideSelected,
    onBulkPurgeSelected,
    onHideAllVisibleLocal,
  } = p

  const morgImportTitle =
    apiStatus?.connected !== true
      ? '.morg-pkg import: API nicht verbunden (/connect).'
      : apiStatus?.locked
        ? '.morg-pkg import: Tresor gesperrt (unlock).'
        : 'morgendrot.morgpkg.v1 – braucht Verbindung und Tresor; Absender der Datei muss in der peerMap sein'
  const morgDeviceTitle =
    morgPkgDeviceBusy
      ? 'Paket wird erstellt…'
      : apiStatus?.connected !== true
        ? 'Gerät → .morg-pkg: API nicht verbunden (/connect).'
        : apiStatus?.locked
          ? 'Gerät → .morg-pkg: Tresor gesperrt.'
          : 'Mehrere Bilder (.txt, Opus/Ogg) → ein .morg-pkg (Bundle v1); braucht Verbindung, Tresor und /compact-image-encode'

  return (
    <div className="border-b border-border">
    <div className="flex flex-wrap items-center justify-between gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Inbox className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Posteingang</h3>
        {messageCount > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {inboxRowCount}
          </span>
        )}
        {role === 'boss' && (
          <label className="ml-2 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={bossView}
              onChange={(e) => onBossViewChange(e.target.checked)}
              className="rounded border-border"
            />
            Boss-Übersicht (an mich + an Kommandanten)
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={morgPkgFileRef}
          type="file"
          accept=".json,.morg-pkg,application/json"
          className="hidden"
          onChange={onMorgPkgImportFile}
        />
        <input
          ref={morgPkgDeviceFilesRef}
          type="file"
          multiple
          accept="image/*,.txt,text/plain,.opus,.ogg,audio/ogg,audio/opus,application/ogg"
          className="hidden"
          onChange={onMorgPkgDeviceFiles}
        />
        <button
          type="button"
          disabled={apiStatus?.connected !== true || apiStatus?.locked}
          onClick={() => morgPkgFileRef.current?.click()}
          className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          title={morgImportTitle}
        >
          .morg-pkg import
        </button>
        <button
          type="button"
          disabled={morgPkgDeviceBusy || apiStatus?.locked || apiStatus?.connected !== true}
          onClick={() => morgPkgDeviceFilesRef.current?.click()}
          className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          title={morgDeviceTitle}
        >
          {morgPkgDeviceBusy ? 'Paket…' : 'Gerät → .morg-pkg'}
        </button>
        <div
          className="flex w-full flex-wrap items-center gap-2 border-l border-border/70 pl-3 sm:w-auto sm:pl-3"
          role="group"
          aria-label="Export Einsatzbericht"
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Export</span>
          <button
            type="button"
            disabled={messageCount === 0}
            onClick={onExportEinsatzberichtJson}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            title="Rohdaten chronologisch (JSON). Für Technik/Backup; kann sehr sensibel sein."
          >
            <FileDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            JSON
          </button>
          <button
            type="button"
            disabled={messageCount === 0}
            onClick={onExportEinsatzberichtTxt}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            title="Kurzfassung lesbar als .txt – für schnelle Übersicht oder Weiterleitung."
          >
            Kurzbericht .txt
          </button>
          <button
            type="button"
            disabled={messageCount === 0}
            onClick={() => void onExportEinsatzberichtEncrypted()}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            title="Ein verschlüsselter Download (AES-GCM); öffnen mit einsatzbericht-decrypt.html im Projekt."
          >
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Kurzbericht verschl.
          </button>
          <button
            type="button"
            disabled={messageCount === 0}
            onClick={() => void onExportEinsatzprotokoll()}
            className="inline-flex max-w-[12rem] items-center gap-1 rounded-lg border border-primary/35 bg-primary/10 px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/15 disabled:opacity-50"
            title="Erstellt intern ZIP (JSON/HTML/Medien), verschlüsselt es und lädt *.zip.enc.json herunter — kein direktes .zip. Passwort: zuerst bei den Browser-Abfragen, danach auf der Hilfsseite „ZIP aus .json“. 7-Zip/Explorer können die JSON-Datei nicht entschlüsseln."
          >
            <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Einsatzbericht (ZIP)
          </button>
          <button
            type="button"
            disabled={messageCount === 0}
            onClick={() => void onExportEinsatzprotokollPlainZip()}
            className="inline-flex max-w-[11rem] items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-amber-500/15 disabled:opacity-50"
            title="Direktes .zip zum Entpacken (protokoll.json, protokoll.html, medien/) – vollständiger Verlauf von der API. Nur in vertrauenswürdiger Umgebung (nicht verschlüsselt)."
          >
            <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ZIP Klartext
          </button>
          <button
            type="button"
            disabled={protokollMarkedCount === 0}
            onClick={() => void onExportEinsatzprotokollMarked()}
            className="inline-flex max-w-[12rem] items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            title={
              protokollMarkedCount === 0
                ? 'Deaktiviert: Mindestens eine Posteingangszeile mit dem Stern (★) markieren.'
                : 'Wie Einsatzbericht (ZIP), aber nur mit ★ markierte Nachrichten.'
            }
          >
            <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ZIP nur ★ ({protokollMarkedCount})
          </button>
          <a
            href="/einsatzbericht-decrypt.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-[10rem] items-center gap-1 rounded-lg border border-dashed border-border bg-background px-2 py-1.5 text-xs text-foreground underline-offset-2 hover:bg-muted hover:underline"
            title="Öffnet die Hilfsseite im Browser: JSON einfügen oder wählen, Passwort eingeben, echtes ZIP herunterladen (innerhalb und außerhalb des Messengers möglich)."
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ZIP aus .json
          </a>
        </div>
        <ChatViewProtokollAnchorButton
          messageCount={messageCount}
          messages={messages}
          myAddress={myAddress}
          recipient={recipient}
          apiConnected={apiStatus?.connected === true && apiStatus?.locked !== true}
          setStatus={setStatus}
          setStatusMsg={setStatusMsg}
        />
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-2 text-xs">
      <button
        type="button"
        onClick={() => setInboxSelectMode((v) => !v)}
        className="rounded-md border border-border bg-muted/40 px-2 py-1 font-medium text-foreground hover:bg-muted"
      >
        {inboxSelectMode ? 'Auswahl beenden' : 'Auswahl'}
      </button>
      {inboxSelectMode && (
        <>
          <button
            type="button"
            onClick={onSelectAllVisible}
            className="rounded-md border border-border px-2 py-1 hover:bg-muted"
          >
            Alle anwählen
          </button>
          <button
            type="button"
            onClick={onClearInboxSelection}
            className="rounded-md border border-border px-2 py-1 hover:bg-muted"
          >
            Keine
          </button>
          <button
            type="button"
            disabled={selectedInboxCount === 0}
            onClick={onBulkHideSelected}
            className="rounded-md border border-border px-2 py-1 hover:bg-muted disabled:opacity-50"
          >
            Ausgewählte lokal ausblenden ({selectedInboxCount})
          </button>
          <button
            type="button"
            disabled={selectedInboxCount === 0 || apiStatus?.connected !== true}
            onClick={onBulkPurgeSelected}
            className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive hover:bg-destructive/20 disabled:opacity-50"
          >
            Ausgewählte auf Chain löschen
          </button>
        </>
      )}
      <button
        type="button"
        disabled={messageCount === 0}
        onClick={onHideAllVisibleLocal}
        className="rounded-md border border-border px-2 py-1 hover:bg-muted disabled:opacity-50"
        title="Blendet alle aktuell sichtbaren Zeilen nur in diesem Browser aus (sessionStorage)."
      >
        Alle sichtbaren lokal ausblenden
      </button>
      <span className="max-w-md text-muted-foreground" title="sessionStorage bis Tab schließen">
        Lokal ausblenden: erscheint wieder nach Tab-Schließen/Leeren oder anderem Gerät; Chain unverändert.
      </span>
    </div>
    </div>
  )
}
