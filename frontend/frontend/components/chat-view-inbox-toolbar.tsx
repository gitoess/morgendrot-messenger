'use client'

/**
 * Posteingang: Kopfzeile (Zähler, Boss-Ansicht, .morg-pkg, Aktualisieren).
 * Reine Präsentation; kein Mesh-Routing. Meshtastic-First: Funk bleibt im Meshtastic-Stack/Firmware –
 * diese Leiste bedient IOTA-Mailbox-Refresh und Sneakernet/morg-pkg, ohne parallele „Funkprotokolle“ in der UI.
 */

import type { ChangeEvent, RefObject } from 'react'
import { Archive, ChevronDown, FileDown, Inbox, KeyRound, Lock, Package, RefreshCw } from 'lucide-react'
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

  return (
    <div className="border-b border-border">
    <div className="flex flex-wrap items-center justify-between gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Inbox className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Posteingang</h3>
        <span className="sr-only">Telefonbuch: Zeilenmenü bei eingehenden 0x-Absendern.</span>
        {messageCount > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {messageCount}
          </span>
        )}
        {inboxRowCount !== messageCount && (
          <span className="text-xs text-muted-foreground">{inboxRowCount} sichtbar</span>
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
              onSelect={(e) => {
                e.preventDefault()
                morgPkgFileRef.current?.click()
              }}
            >
              .morg-pkg import
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={morgPkgDeviceBusy || apiStatus?.locked || apiStatus?.connected !== true}
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
            <DropdownMenuItem disabled={messageCount === 0} onSelect={() => onExportEinsatzberichtJson()}>
              <FileDown className="mr-2 h-4 w-4 opacity-80" aria-hidden />
              JSON (voll)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={messageCount === 0} onSelect={() => onExportEinsatzberichtTxt()}>
              Kurzbericht .txt
            </DropdownMenuItem>
            <DropdownMenuItem disabled={messageCount === 0} onSelect={() => void onExportEinsatzberichtEncrypted()}>
              <Lock className="mr-2 h-4 w-4 opacity-80" aria-hidden />
              Kurzbericht verschlüsselt
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={messageCount === 0} onSelect={() => void onExportEinsatzprotokoll()}>
              <Archive className="mr-2 h-4 w-4 opacity-80" aria-hidden />
              Einsatzbericht (ZIP, verschlüsselt)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={messageCount === 0} onSelect={() => void onExportEinsatzprotokollPlainZip()}>
              ZIP Klartext
            </DropdownMenuItem>
            <DropdownMenuItem disabled={protokollMarkedCount === 0} onSelect={() => void onExportEinsatzprotokollMarked()}>
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
      >
        Alle sichtbaren lokal ausblenden
      </button>
      <span className="sr-only">Lokal ausblenden nur in diesem Browser (sessionStorage).</span>
    </div>
    </div>
  )
}
