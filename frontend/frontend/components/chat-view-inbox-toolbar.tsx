'use client'

/**
 * Posteingang: Kopfzeile (Zähler, Boss-Ansicht, .morg-pkg, Aktualisieren).
 * Reine Präsentation; kein Mesh-Routing. Meshtastic-First: Funk bleibt im Meshtastic-Stack/Firmware –
 * diese Leiste bedient IOTA-Mailbox-Refresh und Sneakernet/morg-pkg, ohne parallele „Funkprotokolle“ in der UI.
 */

import type { ChangeEvent, RefObject } from 'react'
import { Archive, ChevronDown, FileDown, Inbox, KeyRound, Lock, Package, RefreshCw, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import { ChatViewProtokollAnchorButton } from '@/frontend/components/chat-view-protokoll-anchor-button'
import type { InboxFeedReadPort } from '@/frontend/features/messenger-ports'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type ChatViewInboxToolbarProps = InboxFeedReadPort & {
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
        {role === 'boss' && apiStatus?.uiVariant !== 'messenger' ? (
          <label className="ml-2 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={bossView}
              onChange={(e) => onBossViewChange(e.target.checked)}
              className="rounded border-border"
            />
            Boss-Übersicht (Posteingang: an mich + an Kommandanten)
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Package className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Pakete
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[14rem]">
            <DropdownMenuItem
              disabled={apiStatus?.connected !== true || apiStatus?.locked}
              title={morgImportTitle}
              onSelect={(e) => {
                e.preventDefault()
                morgPkgFileRef.current?.click()
              }}
            >
              .morg-pkg import
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={morgPkgDeviceBusy || apiStatus?.locked || apiStatus?.connected !== true}
              title={morgDeviceTitle}
              onSelect={(e) => {
                e.preventDefault()
                morgPkgDeviceFilesRef.current?.click()
              }}
            >
              {morgPkgDeviceBusy ? 'Gerät → .morg-pkg (läuft…)' : 'Gerät → .morg-pkg'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Archive className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Export
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[min(70vh,28rem)] w-[min(100vw-2rem,18rem)] overflow-y-auto">
            <DropdownMenuItem
              disabled={messageCount === 0}
              title="Rohdaten chronologisch (JSON). Für Technik/Backup; kann sehr sensibel sein."
              onSelect={() => onExportEinsatzberichtJson()}
            >
              <FileDown className="mr-2 h-4 w-4 opacity-80" aria-hidden />
              JSON (voll)
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={messageCount === 0}
              title="Kurzfassung lesbar als .txt – für schnelle Übersicht oder Weiterleitung."
              onSelect={() => onExportEinsatzberichtTxt()}
            >
              Kurzbericht .txt
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={messageCount === 0}
              title="Ein verschlüsselter Download (AES-GCM); öffnen mit einsatzbericht-decrypt.html im Projekt."
              onSelect={() => void onExportEinsatzberichtEncrypted()}
            >
              <Lock className="mr-2 h-4 w-4 opacity-80" aria-hidden />
              Kurzbericht verschlüsselt
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={messageCount === 0}
              title="Intern ZIP, Download *.zip.enc.json — Passwort bei Abfragen und auf Hilfsseite."
              onSelect={() => void onExportEinsatzprotokoll()}
            >
              <Archive className="mr-2 h-4 w-4 opacity-80" aria-hidden />
              Einsatzbericht (ZIP, verschlüsselt)
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={messageCount === 0}
              title="Direktes .zip zum Entpacken — nur in vertrauenswürdiger Umgebung."
              onSelect={() => void onExportEinsatzprotokollPlainZip()}
            >
              ZIP Klartext
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={protokollMarkedCount === 0}
              title={
                protokollMarkedCount === 0
                  ? 'Mindestens eine Zeile mit ★ markieren.'
                  : 'Nur ★-markierte Nachrichten.'
              }
              onSelect={() => void onExportEinsatzprotokollMarked()}
            >
              ZIP nur ★ ({protokollMarkedCount})
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a
                href="/einsatzbericht-decrypt.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex cursor-pointer items-center"
                title="Hilfsseite: JSON + Passwort → echtes ZIP."
              >
                <KeyRound className="mr-2 h-4 w-4 opacity-80" aria-hidden />
                ZIP aus .json (Hilfe)
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
    <p className="bg-muted/20 px-4 py-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">
      <UserPlus className="mr-1 inline h-3 w-3 shrink-0 align-text-bottom opacity-80" aria-hidden />
      <span className="font-medium text-foreground/80">Telefonbuch:</span> bei eingehenden Zeilen mit 0x-Absender im
      Zeilenmenü <span className="font-mono text-[10px]">⋯</span> den Punkt „Ins Telefonbuch“ wählen (nicht bei
      eigenen Ausgängen).
    </p>
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
